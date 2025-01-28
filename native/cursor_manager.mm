#import <Foundation/Foundation.h>
#import <Cocoa/Cocoa.h>
#import <node_api.h>

static napi_value HideCursor(napi_env env, napi_callback_info info) {
    @autoreleasepool {
        [NSCursor hide];
    }
    napi_value undefined;
    napi_get_undefined(env, &undefined);
    return undefined;
}

static napi_value ShowCursor(napi_env env, napi_callback_info info) {
    @autoreleasepool {
        [NSCursor unhide];
    }
    napi_value undefined;
    napi_get_undefined(env, &undefined);
    return undefined;
}

static napi_value Init(napi_env env, napi_value exports) {
    napi_status status;
    napi_value fn_hide, fn_show;
    
    status = napi_create_function(env, NULL, 0, HideCursor, NULL, &fn_hide);
    if (status != napi_ok) return NULL;
    
    status = napi_create_function(env, NULL, 0, ShowCursor, NULL, &fn_show);
    if (status != napi_ok) return NULL;
    
    status = napi_set_named_property(env, exports, "hideCursor", fn_hide);
    if (status != napi_ok) return NULL;
    
    status = napi_set_named_property(env, exports, "showCursor", fn_show);
    if (status != napi_ok) return NULL;
    
    return exports;
}

NAPI_MODULE(NODE_GYP_MODULE_NAME, Init) 