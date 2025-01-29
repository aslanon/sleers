#import <Foundation/Foundation.h>
#import <AVFoundation/AVAsset.h>
#import <AVFoundation/AVAssetWriter.h>
#import <AVFoundation/AVAssetWriterInput.h>
#import <AVFoundation/AVMediaFormat.h>
#import <CoreMedia/CoreMedia.h>
#import <CoreGraphics/CoreGraphics.h>
#import <QuartzCore/QuartzCore.h>
#import <node_api.h>

@interface ScreenRecorder : NSObject {
    CGDirectDisplayID _displayID;
    dispatch_queue_t _queue;
    BOOL _isRecording;
    CGRect _recordingRect;
    NSString *_outputPath;
    AVAssetWriter *_assetWriter;
    AVAssetWriterInput *_assetWriterInput;
    AVAssetWriterInputPixelBufferAdaptor *_pixelBufferAdaptor;
    NSError *_lastError;
}

@property (nonatomic, strong) AVAssetWriter *assetWriter;
@property (nonatomic, strong) AVAssetWriterInput *assetWriterInput;
@property (nonatomic, strong) AVAssetWriterInputPixelBufferAdaptor *pixelBufferAdaptor;
@property (nonatomic, strong, readonly) NSError *lastError;

- (instancetype)initWithDisplayID:(CGDirectDisplayID)displayID;
- (BOOL)startRecordingToFile:(NSString *)path withRect:(CGRect)rect error:(NSError **)error;
- (void)stopRecording:(void (^)(BOOL success))completion;

@end

@implementation ScreenRecorder

@synthesize assetWriter = _assetWriter;
@synthesize assetWriterInput = _assetWriterInput;
@synthesize pixelBufferAdaptor = _pixelBufferAdaptor;
@synthesize lastError = _lastError;

- (instancetype)initWithDisplayID:(CGDirectDisplayID)displayID {
    self = [super init];
    if (self) {
        _displayID = displayID;
        _queue = dispatch_queue_create("com.sleer.screenrecorder", DISPATCH_QUEUE_SERIAL);
        _isRecording = NO;
        _lastError = nil;
    }
    return self;
}

- (BOOL)startRecordingToFile:(NSString *)path withRect:(CGRect)rect error:(NSError **)error {
    if (_isRecording) {
        if (error) {
            *error = [NSError errorWithDomain:@"com.sleer.screenrecorder"
                                       code:1
                                   userInfo:@{NSLocalizedDescriptionKey: @"Kayıt zaten devam ediyor"}];
        }
        return NO;
    }
    
    if (!path || [path length] == 0) {
        if (error) {
            *error = [NSError errorWithDomain:@"com.sleer.screenrecorder"
                                       code:2
                                   userInfo:@{NSLocalizedDescriptionKey: @"Geçersiz dosya yolu"}];
        }
        return NO;
    }
    
    if (rect.size.width <= 0 || rect.size.height <= 0) {
        if (error) {
            *error = [NSError errorWithDomain:@"com.sleer.screenrecorder"
                                       code:3
                                   userInfo:@{NSLocalizedDescriptionKey: @"Geçersiz kayıt alanı boyutları"}];
        }
        return NO;
    }
    
    _outputPath = path;
    _recordingRect = rect;
    
    NSError *setupError = nil;
    if (![self setupAssetWriterWithError:&setupError]) {
        if (error) {
            *error = setupError;
        }
        _lastError = setupError;
        return NO;
    }
    
    _isRecording = YES;
    [self captureFrames];
    
    return YES;
}

- (BOOL)setupAssetWriterWithError:(NSError **)error {
    NSURL *fileURL = [NSURL fileURLWithPath:_outputPath];
    self.assetWriter = [[AVAssetWriter alloc] initWithURL:fileURL
                                           fileType:AVFileTypeQuickTimeMovie
                                              error:error];
    if (!self.assetWriter) return NO;
    
    NSDictionary *videoSettings = @{
        AVVideoCodecKey: AVVideoCodecTypeH264,
        AVVideoWidthKey: @((NSInteger)_recordingRect.size.width),
        AVVideoHeightKey: @((NSInteger)_recordingRect.size.height)
    };
    
    self.assetWriterInput = [[AVAssetWriterInput alloc] initWithMediaType:AVMediaTypeVideo
                                                      outputSettings:videoSettings];
    self.assetWriterInput.expectsMediaDataInRealTime = YES;
    
    NSDictionary *pixelBufferAttributes = @{
        (NSString*)kCVPixelBufferPixelFormatTypeKey: @(kCVPixelFormatType_32BGRA),
        (NSString*)kCVPixelBufferWidthKey: @((NSInteger)_recordingRect.size.width),
        (NSString*)kCVPixelBufferHeightKey: @((NSInteger)_recordingRect.size.height)
    };
    
    self.pixelBufferAdaptor = [[AVAssetWriterInputPixelBufferAdaptor alloc]
                          initWithAssetWriterInput:self.assetWriterInput
                          sourcePixelBufferAttributes:pixelBufferAttributes];
    
    if (![self.assetWriter canAddInput:self.assetWriterInput]) return NO;
    [self.assetWriter addInput:self.assetWriterInput];
    
    return [self.assetWriter startWriting];
}

- (void)captureFrames {
    dispatch_async(_queue, ^{
        CVPixelBufferRef pixelBuffer = NULL;
        CGImageRef screenImage = NULL;
        
        CMTime startTime = CMTimeMake(0, 1000);
        [self.assetWriter startSessionAtSourceTime:startTime];
        
        while (self->_isRecording) {
            @autoreleasepool {
                screenImage = CGDisplayCreateImage(self->_displayID);
                if (!screenImage) continue;
                
                CGImageRef croppedImage = CGImageCreateWithImageInRect(screenImage, self->_recordingRect);
                CGImageRelease(screenImage);
                
                if (!croppedImage) continue;
                
                CVPixelBufferCreate(kCFAllocatorDefault,
                                  CGImageGetWidth(croppedImage),
                                  CGImageGetHeight(croppedImage),
                                  kCVPixelFormatType_32BGRA,
                                  NULL,
                                  &pixelBuffer);
                
                if (!pixelBuffer) {
                    CGImageRelease(croppedImage);
                    continue;
                }
                
                CVPixelBufferLockBaseAddress(pixelBuffer, 0);
                void *pxdata = CVPixelBufferGetBaseAddress(pixelBuffer);
                
                CGColorSpaceRef colorSpace = CGColorSpaceCreateDeviceRGB();
                CGContextRef context = CGBitmapContextCreate(pxdata,
                                                           CGImageGetWidth(croppedImage),
                                                           CGImageGetHeight(croppedImage),
                                                           8,
                                                           CVPixelBufferGetBytesPerRow(pixelBuffer),
                                                           colorSpace,
                                                           kCGImageAlphaNoneSkipFirst | kCGBitmapByteOrder32Little);
                
                CGColorSpaceRelease(colorSpace);
                CGContextDrawImage(context, CGRectMake(0, 0, CGImageGetWidth(croppedImage), CGImageGetHeight(croppedImage)), croppedImage);
                CGContextRelease(context);
                CGImageRelease(croppedImage);
                
                CVPixelBufferUnlockBaseAddress(pixelBuffer, 0);
                
                if ([self.assetWriterInput isReadyForMoreMediaData]) {
                    CMTime presentTime = CMTimeMake(CACurrentMediaTime() * 1000, 1000);
                    [self.pixelBufferAdaptor appendPixelBuffer:pixelBuffer withPresentationTime:presentTime];
                }
                
                CVPixelBufferRelease(pixelBuffer);
            }
            
            usleep(1000000 / 60); // 60 FPS
        }
        
        [self.assetWriterInput markAsFinished];
        [self.assetWriter finishWritingWithCompletionHandler:^{
            dispatch_async(dispatch_get_main_queue(), ^{
                if (self.assetWriter.status == AVAssetWriterStatusCompleted) {
                    NSLog(@"Recording saved successfully");
                } else {
                    NSLog(@"Error saving recording: %@", self.assetWriter.error);
                }
            });
        }];
    });
}

- (void)stopRecording:(void (^)(BOOL success))completion {
    _isRecording = NO;
    dispatch_async(_queue, ^{
        if (completion) {
            completion(YES);
        }
    });
}

@end

// Node.js N-API bindings
static ScreenRecorder *recorder = nil;

napi_value StartRecording(napi_env env, napi_callback_info info) {
    size_t argc = 5;
    napi_value args[5];
    napi_get_cb_info(env, info, &argc, args, NULL, NULL);
    
    if (argc < 5) {
        napi_throw_error(env, NULL, "Eksik parametreler");
        return NULL;
    }
    
    char path[1024];
    size_t path_len;
    napi_get_value_string_utf8(env, args[0], path, 1024, &path_len);
    
    double x, y, width, height;
    napi_get_value_double(env, args[1], &x);
    napi_get_value_double(env, args[2], &y);
    napi_get_value_double(env, args[3], &width);
    napi_get_value_double(env, args[4], &height);
    
    if (width <= 0 || height <= 0) {
        napi_throw_error(env, NULL, "Geçersiz kayıt alanı boyutları");
        return NULL;
    }
    
    if (!recorder) {
        recorder = [[ScreenRecorder alloc] initWithDisplayID:CGMainDisplayID()];
    }
    
    NSError *error = nil;
    BOOL success = [recorder startRecordingToFile:[NSString stringWithUTF8String:path]
                                       withRect:CGRectMake(x, y, width, height)
                                         error:&error];
    
    if (!success && error) {
        napi_throw_error(env, NULL, [[error localizedDescription] UTF8String]);
        return NULL;
    }
    
    napi_value result;
    napi_get_boolean(env, success, &result);
    return result;
}

napi_value StopRecording(napi_env env, napi_callback_info info) {
    if (!recorder) {
        napi_value result;
        napi_get_boolean(env, false, &result);
        return result;
    }
    
    [recorder stopRecording:^(BOOL success) {
        recorder = nil;
    }];
    
    napi_value result;
    napi_get_boolean(env, true, &result);
    return result;
}

napi_value Init(napi_env env, napi_value exports) {
    napi_value start_fn, stop_fn;
    
    napi_create_function(env, NULL, 0, StartRecording, NULL, &start_fn);
    napi_create_function(env, NULL, 0, StopRecording, NULL, &stop_fn);
    
    napi_set_named_property(env, exports, "startRecording", start_fn);
    napi_set_named_property(env, exports, "stopRecording", stop_fn);
    
    return exports;
}

NAPI_MODULE(NODE_GYP_MODULE_NAME, Init) 