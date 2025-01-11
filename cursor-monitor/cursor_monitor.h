#ifndef CURSOR_MONITOR_H
#define CURSOR_MONITOR_H

#include <napi.h>
#include <queue>
#include <mutex>

class CursorMonitor : public Napi::ObjectWrap<CursorMonitor> {
 public:
  static Napi::Object Init(Napi::Env env, Napi::Object exports);
  CursorMonitor(const Napi::CallbackInfo& info);
  ~CursorMonitor();
  void EmitCursorChange(const std::string& cursorType);

 private:
  static Napi::FunctionReference constructor;
  
  Napi::Value Start(const Napi::CallbackInfo& info);
  Napi::Value Stop(const Napi::CallbackInfo& info);
  
  Napi::ThreadSafeFunction tsfn_;
  bool isRunning_;
  void* eventTap_;
  std::mutex mutex_;
};

#endif // CURSOR_MONITOR_H
