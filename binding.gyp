{
  "targets": [
    {
      "target_name": "screen_recorder",
      "sources": [ "native/screen_recorder.mm" ],
      "include_dirs": [
        "<!@(node -p \"require('node-addon-api').include\")"
      ],
      "dependencies": [
        "<!(node -p \"require('node-addon-api').gyp\")"
      ],
      "conditions": [
        ['OS=="mac"', {
          "xcode_settings": {
            "MACOSX_DEPLOYMENT_TARGET": "10.15",
            "CLANG_CXX_LIBRARY": "libc++",
            "GCC_ENABLE_CPP_EXCEPTIONS": "YES",
            "OTHER_CFLAGS": [
              "-fobjc-arc",
              "-arch arm64"
            ],
            "OTHER_LDFLAGS": [
              "-framework AVFoundation",
              "-framework CoreMedia",
              "-framework CoreGraphics",
              "-framework Foundation",
              "-arch arm64"
            ],
            "ARCHS": ["arm64"],
            "VALID_ARCHS": ["arm64"]
          }
        }]
      ]
    }
  ]
} 