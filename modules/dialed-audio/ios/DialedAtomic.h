//
//  DialedAtomic.h
//  DialedAudio — lock-free real-time parameter exchange primitives.
//
//  Header-only C11 stdatomic seqlock. Swift 6's Synchronization.Atomic
//  requires iOS 18+; Dialed targets iOS 15.1, so lock-free ordering is
//  provided here and consumed by Swift through the pod's underlying module.
//
//  Topology: single-writer (Expo module serial queue) / single-reader
//  (Core Audio IO thread) seqlock guarding a plain parameter struct.
//
//    writer:  da_seq_write_begin(l); <mutate payload>; da_seq_write_end(l);
//    reader:  do { v = da_seq_read_begin(l); <copy payload>; }
//             while (da_seq_read_retry(l, v));
//
//  The writer's critical section is a ~64-byte struct assignment on a
//  non-RT thread, so the reader's retry loop is bounded in practice to at
//  most one iteration. No locks, no syscalls, no priority inversion: the
//  IO thread can never block on a lower-priority thread — it only re-copies.
//

#ifndef DialedAtomic_h
#define DialedAtomic_h

#include <stdatomic.h>
#include <stdbool.h>
#include <stdint.h>

typedef struct {
  _Atomic uint32_t seq;
} da_seqlock;

static inline void da_seq_init(da_seqlock *l) {
  atomic_store_explicit(&l->seq, 0u, memory_order_relaxed);
}

/// Non-RT writer only. Makes the sequence odd (write in progress).
static inline void da_seq_write_begin(da_seqlock *l) {
  atomic_fetch_add_explicit(&l->seq, 1u, memory_order_acq_rel);
}

/// Non-RT writer only. Makes the sequence even again (write published).
static inline void da_seq_write_end(da_seqlock *l) {
  atomic_fetch_add_explicit(&l->seq, 1u, memory_order_acq_rel);
}

/// RT reader: returns an even sequence observed before the payload copy.
/// Spins only while a (nanoseconds-long) write is mid-flight.
static inline uint32_t da_seq_read_begin(da_seqlock *l) {
  uint32_t v = atomic_load_explicit(&l->seq, memory_order_acquire);
  while ((v & 1u) != 0u) {
    v = atomic_load_explicit(&l->seq, memory_order_acquire);
  }
  return v;
}

/// RT reader: true if the payload copy raced a write and must be redone.
static inline bool da_seq_read_retry(da_seqlock *l, uint32_t begin) {
  atomic_thread_fence(memory_order_acquire);
  return atomic_load_explicit(&l->seq, memory_order_relaxed) != begin;
}

#endif /* DialedAtomic_h */
