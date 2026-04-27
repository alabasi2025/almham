#include <windows.h>
#include <tlhelp32.h>
#include <strsafe.h>

#include <string>
#include <vector>
#include <cstdio>

namespace {

constexpr wchar_t kDefaultTarget[] = L"D:\\almham\\imports\\ECAS-clean-install\\Electricity Customers Accounts System.exe";

std::wstring Quote(const std::wstring& value) {
  if (value.find_first_of(L" \t\"") == std::wstring::npos) {
    return value;
  }

  std::wstring result = L"\"";
  for (wchar_t ch : value) {
    if (ch == L'"') {
      result += L'\\';
    }
    result += ch;
  }
  result += L"\"";
  return result;
}

std::wstring GetDirectory(const std::wstring& path) {
  const size_t pos = path.find_last_of(L"\\/");
  if (pos == std::wstring::npos) {
    return L".";
  }
  return path.substr(0, pos);
}

std::wstring GetModuleDirectory() {
  wchar_t path[MAX_PATH];
  GetModuleFileNameW(nullptr, path, ARRAYSIZE(path));
  return GetDirectory(path);
}

uintptr_t GetRemoteModuleBase(DWORD pid, const wchar_t* module_name) {
  HANDLE snapshot = CreateToolhelp32Snapshot(TH32CS_SNAPMODULE | TH32CS_SNAPMODULE32, pid);
  if (snapshot == INVALID_HANDLE_VALUE) {
    return 0;
  }

  MODULEENTRY32W entry{};
  entry.dwSize = sizeof(entry);

  if (!Module32FirstW(snapshot, &entry)) {
    CloseHandle(snapshot);
    return 0;
  }

  uintptr_t result = 0;
  do {
    if (_wcsicmp(entry.szModule, module_name) == 0 || _wcsicmp(entry.szExePath, module_name) == 0) {
      result = reinterpret_cast<uintptr_t>(entry.modBaseAddr);
      break;
    }
  } while (Module32NextW(snapshot, &entry));

  CloseHandle(snapshot);
  return result;
}

bool InjectHookDll(HANDLE process, DWORD pid, const std::wstring& dll_path) {
  const size_t bytes = (dll_path.size() + 1) * sizeof(wchar_t);
  void* remote_buffer = VirtualAllocEx(process, nullptr, bytes, MEM_COMMIT | MEM_RESERVE, PAGE_READWRITE);
  if (!remote_buffer) {
    std::fwprintf(stderr, L"VirtualAllocEx failed: %lu\n", GetLastError());
    return false;
  }

  if (!WriteProcessMemory(process, remote_buffer, dll_path.c_str(), bytes, nullptr)) {
    std::fwprintf(stderr, L"WriteProcessMemory failed: %lu\n", GetLastError());
    VirtualFreeEx(process, remote_buffer, 0, MEM_RELEASE);
    return false;
  }

  HMODULE local_kernel32 = GetModuleHandleW(L"kernel32.dll");
  auto* local_load_library = reinterpret_cast<unsigned char*>(GetProcAddress(local_kernel32, "LoadLibraryW"));
  auto* local_kernel_base = reinterpret_cast<unsigned char*>(local_kernel32);
  const uintptr_t remote_kernel32 = GetRemoteModuleBase(pid, L"kernel32.dll");
  LPTHREAD_START_ROUTINE remote_load_library = nullptr;
  if (!remote_kernel32) {
    std::fwprintf(stderr, L"Remote kernel32.dll not found, using local LoadLibraryW fallback\n");
    remote_load_library = reinterpret_cast<LPTHREAD_START_ROUTINE>(local_load_library);
  } else {
    const uintptr_t offset = static_cast<uintptr_t>(local_load_library - local_kernel_base);
    remote_load_library = reinterpret_cast<LPTHREAD_START_ROUTINE>(remote_kernel32 + offset);
  }

  HANDLE thread = CreateRemoteThread(process, nullptr, 0, remote_load_library, remote_buffer, 0, nullptr);
  if (!thread) {
    std::fwprintf(stderr, L"CreateRemoteThread failed: %lu\n", GetLastError());
    VirtualFreeEx(process, remote_buffer, 0, MEM_RELEASE);
    return false;
  }

  WaitForSingleObject(thread, 15000);

  DWORD exit_code = 0;
  GetExitCodeThread(thread, &exit_code);
  std::fwprintf(stderr, L"Remote LoadLibraryW exit code: 0x%08lX\n", exit_code);

  CloseHandle(thread);
  VirtualFreeEx(process, remote_buffer, 0, MEM_RELEASE);
  return exit_code != 0;
}

}  // namespace

int wmain(int argc, wchar_t** argv) {
  std::wstring target = argc > 1 ? argv[1] : kDefaultTarget;

  std::vector<std::wstring> parts;
  parts.push_back(Quote(target));
  for (int i = 2; i < argc; ++i) {
    parts.push_back(Quote(argv[i]));
  }

  std::wstring command_line;
  for (size_t i = 0; i < parts.size(); ++i) {
    if (i > 0) {
      command_line += L' ';
    }
    command_line += parts[i];
  }

  std::wstring current_dir = GetDirectory(target);
  std::wstring hook_dll = GetModuleDirectory() + L"\\ecas-hook.dll";
  std::fwprintf(stderr, L"Target: %ls\n", target.c_str());
  std::fwprintf(stderr, L"Hook: %ls\n", hook_dll.c_str());

  STARTUPINFOW si{};
  si.cb = sizeof(si);
  PROCESS_INFORMATION pi{};

  std::wstring mutable_command = command_line;
  if (!CreateProcessW(
          target.c_str(),
          mutable_command.data(),
          nullptr,
          nullptr,
          FALSE,
          CREATE_SUSPENDED,
          nullptr,
          current_dir.c_str(),
          &si,
          &pi)) {
    std::fwprintf(stderr, L"CreateProcessW failed: %lu\n", GetLastError());
    return static_cast<int>(GetLastError());
  }

  const bool injected = InjectHookDll(pi.hProcess, pi.dwProcessId, hook_dll);
  Sleep(1000);

  ResumeThread(pi.hThread);
  WaitForSingleObject(pi.hProcess, INFINITE);

  DWORD exit_code = 0;
  GetExitCodeProcess(pi.hProcess, &exit_code);

  CloseHandle(pi.hThread);
  CloseHandle(pi.hProcess);

  if (!injected) {
    return 2000;
  }

  return static_cast<int>(exit_code);
}
