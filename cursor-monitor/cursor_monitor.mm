#import <Cocoa/Cocoa.h>
#import <CoreGraphics/CoreGraphics.h>
#include "cursor_monitor.h"
#include <iostream>

Napi::FunctionReference CursorMonitor::constructor;

namespace {
    std::string GetCursorType(NSCursor* cursor) {
        if ([cursor isEqual:[NSCursor arrowCursor]]) return "arrow";
        if ([cursor isEqual:[NSCursor IBeamCursor]]) return "ibeam";
        if ([cursor isEqual:[NSCursor pointingHandCursor]]) return "pointing";
        if ([cursor isEqual:[NSCursor resizeLeftRightCursor]]) return "resize-lr";
        if ([cursor isEqual:[NSCursor resizeUpDownCursor]]) return "resize-ud";
        if ([cursor isEqual:[NSCursor crosshairCursor]]) return "crosshair";
        if ([cursor isEqual:[NSCursor disappearingItemCursor]]) return "disappearing";
        if ([cursor isEqual:[NSCursor operationNotAllowedCursor]]) return "not-allowed";
        if ([cursor isEqual:[NSCursor dragLinkCursor]]) return "drag-link";
        if ([cursor isEqual:[NSCursor dragCopyCursor]]) return "drag-copy";
        if ([cursor isEqual:[NSCursor contextualMenuCursor]]) return "contextual-menu";
        return "unknown";
    }

    CGEventRef EventCallback(CGEventTapProxy proxy, CGEventType type, CGEventRef event, void* userInfo) {
        if (type == kCGEventMouseMoved) {
            CGPoint location = CGEventGetLocation(event);
            NSCursor* currentCursor = [NSCursor currentSystemCursor];
            std::string cursorType = GetCursorType(currentCursor);
            
            std::cout << "Mouse moved - Position: (" << location.x << ", " << location.y 
                      << "), Cursor type: " << cursorType << std::endl;
            
            CursorMonitor* monitor = static_cast<CursorMonitor*>(userInfo);
            monitor->EmitCursorChange(cursorType);
        }
        return event;
    }
}

Napi::Object CursorMonitor::Init(Napi::Env env, Napi::Object exports) {
    Napi::Function func = DefineClass(env, "CursorMonitor", {
        InstanceMethod("start", &CursorMonitor::Start),
        InstanceMethod("stop", &CursorMonitor::Stop),
    });

    constructor = Napi::Persistent(func);
    constructor.SuppressDestruct();

    exports.Set("CursorMonitor", func);
    return exports;
}

CursorMonitor::CursorMonitor(const Napi::CallbackInfo& info) 
    : Napi::ObjectWrap<CursorMonitor>(info), isRunning_(false), eventTap_(nullptr) {
    Napi::Env env = info.Env();
    
    if (info.Length() < 1 || !info[0].IsFunction()) {
        Napi::TypeError::New(env, "Callback function expected").ThrowAsJavaScriptException();
        return;
    }

    tsfn_ = Napi::ThreadSafeFunction::New(
        env,
        info[0].As<Napi::Function>(),
        "CursorMonitor",
        0,
        1
    );
}

CursorMonitor::~CursorMonitor() {
    if (isRunning_) {
        if (eventTap_) {
            CGEventTapEnable(static_cast<CFMachPortRef>(eventTap_), false);
            CFRelease(eventTap_);
            eventTap_ = nullptr;
        }
        isRunning_ = false;
    }
    tsfn_.Release();
}

Napi::Value CursorMonitor::Start(const Napi::CallbackInfo& info) {
    std::lock_guard<std::mutex> lock(mutex_);
    
    if (isRunning_) {
        return info.Env().Undefined();
    }

    CGEventMask eventMask = CGEventMaskBit(kCGEventMouseMoved);
    eventTap_ = CGEventTapCreate(
        kCGSessionEventTap,
        kCGHeadInsertEventTap,
        kCGEventTapOptionListenOnly,
        eventMask,
        EventCallback,
        this
    );

    if (!eventTap_) {
        Napi::Error::New(info.Env(), "Failed to create event tap").ThrowAsJavaScriptException();
        return info.Env().Undefined();
    }

    CFRunLoopSourceRef runLoopSource = CFMachPortCreateRunLoopSource(
        kCFAllocatorDefault,
        static_cast<CFMachPortRef>(eventTap_),
        0
    );

    CFRunLoopAddSource(
        CFRunLoopGetCurrent(),
        runLoopSource,
        kCFRunLoopCommonModes
    );

    CGEventTapEnable(
        static_cast<CFMachPortRef>(eventTap_),
        true
    );

    isRunning_ = true;
    return info.Env().Undefined();
}

Napi::Value CursorMonitor::Stop(const Napi::CallbackInfo& info) {
    std::lock_guard<std::mutex> lock(mutex_);
    
    if (!isRunning_) {
        return info.Env().Undefined();
    }

    if (eventTap_) {
        CGEventTapEnable(static_cast<CFMachPortRef>(eventTap_), false);
        CFRelease(eventTap_);
        eventTap_ = nullptr;
    }

    isRunning_ = false;
    return info.Env().Undefined();
}

void CursorMonitor::EmitCursorChange(const std::string& cursorType) {
    if (!isRunning_) return;

    auto callback = [](Napi::Env env, Napi::Function jsCallback, const std::string* data) {
        jsCallback.Call({Napi::String::New(env, *data)});
        delete data;
    };

    tsfn_.BlockingCall(new std::string(cursorType), callback);
}

Napi::Object Init(Napi::Env env, Napi::Object exports) {
    return CursorMonitor::Init(env, exports);
}

NODE_API_MODULE(cursor_monitor, Init)
