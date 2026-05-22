const { withDangerousMod } = require('@expo/config-plugins');
const fs = require('fs');
const path = require('path');

const PATCH_MARKER = 'Patched RCTBridgeModule.h (methodQueue strong -> assign)';

const POST_INSTALL_SNIPPET = `
    rct_bridge_module_h = File.join(
      installer.sandbox.root,
      'Headers/Public/React-Core/React/RCTBridgeModule.h'
    )
    if File.exist?(rct_bridge_module_h)
      text = File.read(rct_bridge_module_h)
      patched = text.gsub(
        '@property (nonatomic, strong, readonly) dispatch_queue_t methodQueue RCT_DEPRECATED;',
        '@property (nonatomic, assign, readonly) dispatch_queue_t methodQueue RCT_DEPRECATED;'
      )
      if text != patched
        File.write(rct_bridge_module_h, patched)
        Pod::UI.puts '${PATCH_MARKER}'
      end
    end

    installer.pods_project.targets.each do |target|
      target.build_configurations.each do |build_config|
        build_config.build_settings['GCC_PREPROCESSOR_DEFINITIONS'] ||= ['$(inherited)']
        build_config.build_settings['GCC_PREPROCESSOR_DEFINITIONS'] << 'OS_OBJECT_USE_OBJC=1'
      end
    end`;

/** Re-apply Xcode 26 RCTBridgeModule patch after every prebuild. */
function withIosPodfilePatch(config) {
  return withDangerousMod(config, [
    'ios',
    async (cfg) => {
      const podfilePath = path.join(cfg.modRequest.platformProjectRoot, 'Podfile');
      let contents = fs.readFileSync(podfilePath, 'utf8');

      if (!contents.includes(PATCH_MARKER)) {
        contents = contents.replace(
          /post_install do \|installer\|\n/,
          `post_install do |installer|\n${POST_INSTALL_SNIPPET}\n`
        );
        fs.writeFileSync(podfilePath, contents);
      }

      return cfg;
    },
  ]);
}

module.exports = withIosPodfilePatch;
