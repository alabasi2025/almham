#include <windows.h>

#pragma comment(linker, "/EXPORT:WCheckPlatformBiVBA=_WCheckPlatformBiVBA@0")
#pragma comment(linker, "/EXPORT:VersionNumberBiVBA=_VersionNumberBiVBA@4")
#pragma comment(linker, "/EXPORT:DestroyCaretBiVBA=_DestroyCaretBiVBA@0")
#pragma comment(linker, "/EXPORT:CreateCaretBiVBA=_CreateCaretBiVBA@16")
#pragma comment(linker, "/EXPORT:ResetFontCacheBiVBA=_ResetFontCacheBiVBA@0")
#pragma comment(linker, "/EXPORT:XFromIchCoreBiVBA=_XFromIchCoreBiVBA@4")
#pragma comment(linker, "/EXPORT:IchFromXCoreBiVBA=_IchFromXCoreBiVBA@4")
#pragma comment(linker, "/EXPORT:PaintLineCoreBiVBA=_PaintLineCoreBiVBA@16")
#pragma comment(linker, "/EXPORT:PaintLineCoreROClipBiVBA=_PaintLineCoreROClipBiVBA@16")
#pragma comment(linker, "/EXPORT:ObTextOutBiVBA=_ObTextOutBiVBA@0")
#pragma comment(linker, "/EXPORT:PickFontBiVBA=_PickFontBiVBA@0")

static void AppendLine(const char* line) {
  HANDLE file = CreateFileA(
      "D:\\almham\\imports\\_ecas-launcher\\vbame-stub.log",
      FILE_APPEND_DATA,
      FILE_SHARE_READ | FILE_SHARE_WRITE | FILE_SHARE_DELETE,
      NULL,
      OPEN_ALWAYS,
      FILE_ATTRIBUTE_NORMAL,
      NULL);
  if (file == INVALID_HANDLE_VALUE) {
    return;
  }

  DWORD written = 0;
  WriteFile(file, line, (DWORD)lstrlenA(line), &written, NULL);
  CloseHandle(file);
}

__declspec(dllexport) int __stdcall WCheckPlatformBiVBA(void) {
  AppendLine("WCheckPlatformBiVBA called -> 3\r\n");
  return 3;
}

__declspec(dllexport) unsigned long __stdcall VersionNumberBiVBA(unsigned long value) {
  AppendLine("VersionNumberBiVBA called\r\n");
  return (value & 0xFFFF0413UL) | 0x413UL;
}

__declspec(dllexport) int __stdcall DestroyCaretBiVBA(void) {
  AppendLine("DestroyCaretBiVBA called\r\n");
  return 1;
}

__declspec(dllexport) int __stdcall CreateCaretBiVBA(void* window, unsigned long width, unsigned long height, unsigned long flags) {
  (void)window;
  (void)width;
  (void)height;
  (void)flags;
  AppendLine("CreateCaretBiVBA called\r\n");
  return 1;
}

__declspec(dllexport) int __stdcall ResetFontCacheBiVBA(void) {
  AppendLine("ResetFontCacheBiVBA called\r\n");
  return 1;
}

__declspec(dllexport) int __stdcall XFromIchCoreBiVBA(void* context) {
  (void)context;
  AppendLine("XFromIchCoreBiVBA called\r\n");
  return 0;
}

__declspec(dllexport) int __stdcall IchFromXCoreBiVBA(void* context) {
  (void)context;
  AppendLine("IchFromXCoreBiVBA called\r\n");
  return 0;
}

__declspec(dllexport) int __stdcall PaintLineCoreBiVBA(void* context, unsigned long mode, unsigned long flags, void* extra) {
  (void)context;
  (void)mode;
  (void)flags;
  (void)extra;
  AppendLine("PaintLineCoreBiVBA called\r\n");
  return 1;
}

__declspec(dllexport) int __stdcall PaintLineCoreROClipBiVBA(void* context, unsigned long mode, unsigned long flags, void* extra) {
  (void)context;
  (void)mode;
  (void)flags;
  (void)extra;
  AppendLine("PaintLineCoreROClipBiVBA called\r\n");
  return 1;
}

__declspec(dllexport) int __stdcall ObTextOutBiVBA(void) {
  AppendLine("ObTextOutBiVBA called\r\n");
  return 0;
}

__declspec(dllexport) int __stdcall PickFontBiVBA(void) {
  AppendLine("PickFontBiVBA called\r\n");
  return 0;
}

BOOL APIENTRY DllMain(HMODULE module, DWORD reason, LPVOID reserved) {
  (void)module;
  (void)reserved;

  if (reason == DLL_PROCESS_ATTACH) {
    AppendLine("VBAME stub loaded\r\n");
  } else if (reason == DLL_PROCESS_DETACH) {
    AppendLine("VBAME stub unloading\r\n");
  }

  return TRUE;
}
