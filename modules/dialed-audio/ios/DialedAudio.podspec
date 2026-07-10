require 'json'

package = JSON.parse(File.read(File.join(__dir__, '..', 'package.json')))

Pod::Spec.new do |s|
  s.name           = 'DialedAudio'
  s.version        = package['version']
  s.summary        = 'Dialed native binaural audio engine'
  s.description    = 'True-stereo AVAudioEngine binaural + brown-noise engine for Dialed.'
  s.license        = 'MIT'
  s.author         = 'Dialed'
  s.homepage       = 'https://dialed.app'
  s.platforms      = { :ios => '15.1' }
  s.source         = { git: 'https://github.com/dialed/dialed.git' }
  s.static_framework = true

  s.dependency 'ExpoModulesCore'

  s.source_files = "**/*.{h,m,mm,swift,hpp,cpp}"
end
