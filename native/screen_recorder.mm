#include <node_api.h>
#include <AVFoundation/AVFoundation.h>
#include <CoreMedia/CoreMedia.h>
#include <CoreGraphics/CoreGraphics.h>

@interface ScreenRecorder : NSObject
@property (nonatomic, strong) AVAssetWriter *writer;
@property (nonatomic, strong) AVAssetWriterInput *writerInput;
@property (nonatomic, strong) AVCaptureSession *session;
@property (nonatomic, strong) dispatch_queue_t queue;
@property (atomic, assign) BOOL isRecording;

- (napi_value)startRecording:(napi_env)env outputPath:(NSString *)outputPath;
- (napi_value)stopRecording:(napi_env)env;
@end

@implementation ScreenRecorder

- (instancetype)init {
    self = [super init];
    if (self) {
        _queue = dispatch_queue_create("com.sleer.screenrecorder", DISPATCH_QUEUE_SERIAL);
        _isRecording = NO;
    }
    return self;
}

- (napi_value)startRecording:(napi_env)env outputPath:(NSString *)outputPath {
    napi_value result;
    
    if (self.isRecording) {
        napi_create_string_utf8(env, "Recording is already in progress", NAPI_AUTO_LENGTH, &result);
        return result;
    }

    @try {
        // Ana ekranı al
        CGDirectDisplayID displayID = CGMainDisplayID();
        
        // Ekran boyutlarını al
        CGRect screenBounds = CGDisplayBounds(displayID);
        int width = screenBounds.size.width;
        int height = screenBounds.size.height;

        // Video ayarları
        NSDictionary *videoSettings = @{
            AVVideoCodecKey: AVVideoCodecTypeH264,
            AVVideoWidthKey: @(width),
            AVVideoHeightKey: @(height),
            AVVideoCompressionPropertiesKey: @{
                AVVideoAverageBitRateKey: @(8000000),
                AVVideoMaxKeyFrameIntervalKey: @(30),
                AVVideoProfileLevelKey: AVVideoProfileLevelH264HighAutoLevel
            }
        };

        // Asset Writer oluştur
        NSURL *outputURL = [NSURL fileURLWithPath:outputPath];
        self.writer = [[AVAssetWriter alloc] initWithURL:outputURL fileType:AVFileTypeQuickTimeMovie error:nil];
        self.writerInput = [AVAssetWriterInput assetWriterInputWithMediaType:AVMediaTypeVideo outputSettings:videoSettings];
        self.writerInput.expectsMediaDataInRealTime = YES;
        [self.writer addInput:self.writerInput];

        // Display stream ayarları
        CGDisplayStreamRef displayStream = CGDisplayStreamCreate(
            displayID,
            width,
            height,
            'BGRA',  // Video formatı
            nil,     // Stream ayarları
            ^(CGDisplayStreamFrameStatus status, uint64_t displayTime, IOSurfaceRef frameSurface, CGDisplayStreamUpdateRef updateRef) {
                if (status != kCGDisplayStreamFrameStatusFrameComplete || !self.isRecording) {
                    return;
                }

                if (self.writerInput.isReadyForMoreMediaData) {
                    // Frame'i CVPixelBuffer'a dönüştür
                    CVPixelBufferRef pixelBuffer = nil;
                    CVPixelBufferCreateWithIOSurface(kCFAllocatorDefault, frameSurface, nil, &pixelBuffer);

                    // Frame timestamp'ini ayarla
                    CMTime presentationTime = CMTimeMake(displayTime, 60);

                    // Frame'i yaz
                    [self.writerInput appendSampleBuffer:CMSampleBufferCreateForImageBuffer(
                        kCFAllocatorDefault,
                        pixelBuffer,
                        YES,
                        nil,
                        nil,
                        kCMVideoCodecType_H264,
                        &presentationTime,
                        nil
                    )];

                    CVPixelBufferRelease(pixelBuffer);
                }
            }
        );

        // Recording başlat
        [self.writer startWriting];
        [self.writer startSessionAtSourceTime:kCMTimeZero];
        CGDisplayStreamStart(displayStream);
        
        self.isRecording = YES;
        napi_create_string_utf8(env, "Recording started successfully", NAPI_AUTO_LENGTH, &result);
    } @catch (NSException *exception) {
        napi_create_string_utf8(env, [[exception reason] UTF8String], NAPI_AUTO_LENGTH, &result);
    }
    
    return result;
}

- (napi_value)stopRecording:(napi_env)env {
    napi_value result;
    
    if (!self.isRecording) {
        napi_create_string_utf8(env, "No recording in progress", NAPI_AUTO_LENGTH, &result);
        return result;
    }

    @try {
        self.isRecording = NO;

        // Writer'ı kapat
        [self.writerInput markAsFinished];
        [self.writer finishWritingWithCompletionHandler:^{
            dispatch_async(dispatch_get_main_queue(), ^{
                self.writer = nil;
                self.writerInput = nil;
            });
        }];

        napi_create_string_utf8(env, "Recording stopped successfully", NAPI_AUTO_LENGTH, &result);
    } @catch (NSException *exception) {
        napi_create_string_utf8(env, [[exception reason] UTF8String], NAPI_AUTO_LENGTH, &result);
    }
    
    return result;
}

@end

// Node.js modül fonksiyonları
napi_value StartRecording(napi_env env, napi_callback_info info) {
    size_t argc = 1;
    napi_value args[1];
    napi_get_cb_info(env, info, &argc, args, NULL, NULL);
    
    char outputPath[256];
    size_t result;
    napi_get_value_string_utf8(env, args[0], outputPath, 256, &result);
    
    ScreenRecorder *recorder = [[ScreenRecorder alloc] init];
    return [recorder startRecording:env outputPath:[NSString stringWithUTF8String:outputPath]];
}

napi_value StopRecording(napi_env env, napi_callback_info info) {
    ScreenRecorder *recorder = [[ScreenRecorder alloc] init];
    return [recorder stopRecording:env];
}

napi_value Init(napi_env env, napi_value exports) {
    napi_value fn1, fn2;
    napi_create_function(env, NULL, 0, StartRecording, NULL, &fn1);
    napi_create_function(env, NULL, 0, StopRecording, NULL, &fn2);
    napi_set_named_property(env, exports, "startRecording", fn1);
    napi_set_named_property(env, exports, "stopRecording", fn2);
    return exports;
}

NAPI_MODULE(NODE_GYP_MODULE_NAME, Init) 