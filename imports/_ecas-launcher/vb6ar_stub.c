#include <windows.h>

static void AppendLine(const wchar_t* line) {
  HANDLE file = CreateFileW(
      L"D:\\almham\\imports\\_ecas-launcher\\vb6ar-stub.log",
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
  WriteFile(file, line, (DWORD)(lstrlenW(line) * sizeof(wchar_t)), &written, NULL);
  CloseHandle(file);
}

BOOL APIENTRY DllMain(HMODULE module, DWORD reason, LPVOID reserved) {
  (void)module;
  (void)reserved;

  if (reason == DLL_PROCESS_ATTACH) {
    AppendLine(L"VB6AR stub loaded\r\n");
  } else if (reason == DLL_PROCESS_DETACH) {
    AppendLine(L"VB6AR stub unloading\r\n");
  }

  return TRUE;
}
