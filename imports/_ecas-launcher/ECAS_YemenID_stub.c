#include <windows.h>
#include <stdio.h>

static const wchar_t* kLogPath = L"D:\\almham\\imports\\_ecas-launcher\\ECAS_YemenID_stub.log";

static void append_log(const char* text) {
    HANDLE file = CreateFileW(kLogPath, FILE_APPEND_DATA, FILE_SHARE_READ | FILE_SHARE_WRITE, NULL, OPEN_ALWAYS,
                              FILE_ATTRIBUTE_NORMAL, NULL);
    if (file == INVALID_HANDLE_VALUE) {
        return;
    }
    DWORD written = 0;
    WriteFile(file, text, (DWORD)strlen(text), &written, NULL);
    WriteFile(file, "\r\n", 2, &written, NULL);
    CloseHandle(file);
}

BOOL WINAPI DllMain(HINSTANCE instance, DWORD reason, LPVOID reserved) {
    (void)instance;
    (void)reserved;
    if (reason == DLL_PROCESS_ATTACH) {
        append_log("ECAS_YemenID.dll loaded");
    } else if (reason == DLL_PROCESS_DETACH) {
        append_log("ECAS_YemenID.dll unloading");
    }
    return TRUE;
}

__declspec(dllexport) int __stdcall YIDedCheckLicnce07710114(void) {
    append_log("YIDedCheckLicnce07710114 called");
    return 1;
}
