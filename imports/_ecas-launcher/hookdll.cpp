#include <windows.h>
#include <winternl.h>
#include <oaidl.h>
#include <strsafe.h>

#include <atomic>
#include <cstring>
#include <cstdarg>
#include <cstdio>
#include <new>

#pragma comment(lib, "ole32.lib")
#pragma comment(lib, "oleaut32.lib")

HRESULT WINAPI HookLoadRegTypeLib(REFGUID guid, WORD major, WORD minor, LCID lcid, ITypeLib** ppTLib);
HRESULT WINAPI HookQueryPathOfRegTypeLib(REFGUID guid, USHORT major, USHORT minor, LCID lcid, BSTR* path);
HRESULT WINAPI HookLoadTypeLibEx(LPCOLESTR file, REGKIND regkind, ITypeLib** ppTLib);
HRESULT WINAPI HookCoCreateInstance(REFCLSID rclsid, LPUNKNOWN pUnkOuter, DWORD dwClsContext, REFIID riid, LPVOID* ppv);
HRESULT WINAPI HookCoGetClassObject(REFCLSID rclsid, DWORD dwClsContext, LPVOID pvReserved, REFIID riid, LPVOID* ppv);
HRESULT WINAPI HookCoCreateInstanceEx(REFCLSID clsid,
                                      IUnknown* punkOuter,
                                      DWORD dwClsCtx,
                                      COSERVERINFO* pServerInfo,
                                      DWORD cmq,
                                      MULTI_QI* pResults);
HRESULT WINAPI HookCLSIDFromProgID(LPCOLESTR lpszProgID, LPCLSID lpclsid);
LSTATUS WINAPI HookRegOpenKeyExW(HKEY hKey, LPCWSTR lpSubKey, DWORD ulOptions, REGSAM samDesired, PHKEY phkResult);
LSTATUS WINAPI HookRegOpenKeyExA(HKEY hKey, LPCSTR lpSubKey, DWORD ulOptions, REGSAM samDesired, PHKEY phkResult);
HMODULE WINAPI HookLoadLibraryW(LPCWSTR file);
HMODULE WINAPI HookLoadLibraryA(LPCSTR file);
HMODULE WINAPI HookLoadLibraryExW(LPCWSTR file, HANDLE file_handle, DWORD flags);
HMODULE WINAPI HookLoadLibraryExA(LPCSTR file, HANDLE file_handle, DWORD flags);
FARPROC WINAPI HookGetProcAddress(HMODULE module, LPCSTR proc_name);
VOID WINAPI HookExitProcess(UINT exit_code);
BOOL WINAPI HookTerminateProcess(HANDLE process, UINT exit_code);
NTSTATUS NTAPI HookLdrLoadDll(PWSTR search_path, PULONG load_flags, PUNICODE_STRING module_name, PHANDLE module_handle);
NTSTATUS NTAPI HookLdrGetProcedureAddress(PVOID base_address,
                                          PANSI_STRING name,
                                          ULONG ordinal,
                                          PVOID* address);
void HookVbaHresultCheckStub();
void HookVbaHresultCheckObjStub();
void HookDllFunctionCallStub();

namespace {

constexpr wchar_t kLogPath[] = L"D:\\almham\\imports\\_ecas-launcher\\ecas-hook.log";
constexpr wchar_t kPlaceholderPath[] = L"D:\\almham\\imports\\_ecas-launcher\\typelib\\a7ac-placeholder.tlb";
constexpr wchar_t kTargetProcessName[] = L"Electricity Customers Accounts System.exe";
constexpr wchar_t kLocalVB6ArPath[] = L"D:\\almham\\imports\\_ecas-launcher\\VB6AR.dll";
constexpr wchar_t kLocalVBAMEPath[] = L"D:\\almham\\imports\\_ecas-launcher\\VBAME.dll";
constexpr GUID kTargetTypeLib = {0xA7AC8459, 0x490C, 0x40B1, {0xB4, 0x75, 0x3A, 0x38, 0x04, 0x30, 0x71, 0x8B}};

using LoadRegTypeLibFn = HRESULT(WINAPI*)(REFGUID, WORD, WORD, LCID, ITypeLib**);
using QueryPathOfRegTypeLibFn = HRESULT(WINAPI*)(REFGUID, USHORT, USHORT, LCID, BSTR*);
using LoadTypeLibExFn = HRESULT(WINAPI*)(LPCOLESTR, REGKIND, ITypeLib**);
using CoCreateInstanceFn = HRESULT(WINAPI*)(REFCLSID, LPUNKNOWN, DWORD, REFIID, LPVOID*);
using CoGetClassObjectFn = HRESULT(WINAPI*)(REFCLSID, DWORD, LPVOID, REFIID, LPVOID*);
using CoCreateInstanceExFn = HRESULT(WINAPI*)(REFCLSID, IUnknown*, DWORD, COSERVERINFO*, DWORD, MULTI_QI*);
using CLSIDFromProgIDFn = HRESULT(WINAPI*)(LPCOLESTR, LPCLSID);
using RegOpenKeyExWFn = LSTATUS(WINAPI*)(HKEY, LPCWSTR, DWORD, REGSAM, PHKEY);
using RegOpenKeyExAFn = LSTATUS(WINAPI*)(HKEY, LPCSTR, DWORD, REGSAM, PHKEY);
using LoadLibraryWFn = HMODULE(WINAPI*)(LPCWSTR);
using LoadLibraryAFn = HMODULE(WINAPI*)(LPCSTR);
using LoadLibraryExWFn = HMODULE(WINAPI*)(LPCWSTR, HANDLE, DWORD);
using LoadLibraryExAFn = HMODULE(WINAPI*)(LPCSTR, HANDLE, DWORD);
using GetProcAddressFn = FARPROC(WINAPI*)(HMODULE, LPCSTR);
using ExitProcessFn = VOID(WINAPI*)(UINT);
using TerminateProcessFn = BOOL(WINAPI*)(HANDLE, UINT);
using LdrLoadDllFn = NTSTATUS(NTAPI*)(PWSTR, PULONG, PUNICODE_STRING, PHANDLE);
using LdrGetProcedureAddressFn = NTSTATUS(NTAPI*)(PVOID, PANSI_STRING, ULONG, PVOID*);

CRITICAL_SECTION g_logLock;
std::atomic<bool> g_logReady{false};
LoadRegTypeLibFn g_originalLoadRegTypeLib = nullptr;
QueryPathOfRegTypeLibFn g_originalQueryPathOfRegTypeLib = nullptr;
LoadTypeLibExFn g_originalLoadTypeLibEx = nullptr;
CoCreateInstanceFn g_originalCoCreateInstance = nullptr;
CoGetClassObjectFn g_originalCoGetClassObject = nullptr;
CoCreateInstanceExFn g_originalCoCreateInstanceEx = nullptr;
CLSIDFromProgIDFn g_originalCLSIDFromProgID = nullptr;
RegOpenKeyExWFn g_originalRegOpenKeyExW = nullptr;
RegOpenKeyExAFn g_originalRegOpenKeyExA = nullptr;
LoadLibraryWFn g_originalLoadLibraryW = nullptr;
LoadLibraryAFn g_originalLoadLibraryA = nullptr;
LoadLibraryExWFn g_originalLoadLibraryExW = nullptr;
LoadLibraryExAFn g_originalLoadLibraryExA = nullptr;
GetProcAddressFn g_originalGetProcAddress = nullptr;
ExitProcessFn g_originalExitProcess = nullptr;
TerminateProcessFn g_originalTerminateProcess = nullptr;
LdrLoadDllFn g_originalLdrLoadDll = nullptr;
LdrGetProcedureAddressFn g_originalLdrGetProcedureAddress = nullptr;
ITypeLib* g_placeholder = nullptr;
HMODULE g_vb6arModule = nullptr;
HMODULE g_vbameModule = nullptr;
void* g_originalVbaHresultCheck = nullptr;
void* g_originalVbaHresultCheckObj = nullptr;
void* g_originalDllFunctionCall = nullptr;
const char kVbaHresultCheckName[] = "__vbaHresultCheck";
const char kVbaHresultCheckObjName[] = "__vbaHresultCheckObj";
const char kDllFunctionCallName[] = "DllFunctionCall";

void AppendLog(const char* format, ...);
void __stdcall LogVbaRawCall(const char* name, const DWORD* stack);
void DescribeAddress(const void* address, char* buffer, size_t cchBuffer);

bool EndsWithInsensitive(const wchar_t* value, const wchar_t* suffix) {
  if (!value || !suffix) {
    return false;
  }
  const size_t value_len = wcslen(value);
  const size_t suffix_len = wcslen(suffix);
  if (suffix_len > value_len) {
    return false;
  }
  return _wcsicmp(value + (value_len - suffix_len), suffix) == 0;
}

bool ShouldHookCurrentProcess() {
  wchar_t path[MAX_PATH];
  GetModuleFileNameW(nullptr, path, ARRAYSIZE(path));
  return EndsWithInsensitive(path, kTargetProcessName);
}

bool IsPlaceholderPath(LPCOLESTR value) {
  if (!value) {
    return false;
  }
  return EndsWithInsensitive(value, L"a7ac-placeholder.tlb") || EndsWithInsensitive(value, L"EcasPlaceholderControl.tlb");
}

bool IsTargetLibraryName(const wchar_t* value, const wchar_t* library_name) {
  if (!value || !library_name) {
    return false;
  }
  return EndsWithInsensitive(value, library_name);
}

bool ResolveRedirectPath(LPCWSTR requested_path, const wchar_t** redirected_path) {
  if (!requested_path || !redirected_path) {
    return false;
  }

  if (IsTargetLibraryName(requested_path, L"vb6ar.dll")) {
    *redirected_path = kLocalVB6ArPath;
    return true;
  }

  if (IsTargetLibraryName(requested_path, L"vbame.dll")) {
    *redirected_path = kLocalVBAMEPath;
    return true;
  }

  return false;
}

void WideToUtf8(const wchar_t* input, char* output, size_t output_size) {
  if (!output || output_size == 0) {
    return;
  }
  output[0] = '\0';
  if (!input) {
    StringCchCopyA(output, output_size, "<null>");
    return;
  }
  WideCharToMultiByte(CP_UTF8, 0, input, -1, output, static_cast<int>(output_size), nullptr, nullptr);
}

bool IsOrdinalProcName(LPCSTR proc_name) {
  return reinterpret_cast<ULONG_PTR>(proc_name) <= 0xFFFF;
}

void UpdateTrackedModule(LPCWSTR redirected_path, HMODULE module) {
  if (!redirected_path || !module) {
    return;
  }
  if (_wcsicmp(redirected_path, kLocalVB6ArPath) == 0) {
    g_vb6arModule = module;
  } else if (_wcsicmp(redirected_path, kLocalVBAMEPath) == 0) {
    g_vbameModule = module;
  }
}

const char* RegistryRootName(HKEY key) {
  if (key == HKEY_CLASSES_ROOT) {
    return "HKCR";
  }
  if (key == HKEY_CURRENT_USER) {
    return "HKCU";
  }
  if (key == HKEY_LOCAL_MACHINE) {
    return "HKLM";
  }
  if (key == HKEY_USERS) {
    return "HKU";
  }
  return "HKEY?";
}

bool ContainsInsensitive(const wchar_t* value, const wchar_t* needle) {
  if (!value || !needle) {
    return false;
  }
  const size_t needle_len = wcslen(needle);
  if (needle_len == 0) {
    return true;
  }
  for (const wchar_t* p = value; *p; ++p) {
    if (_wcsnicmp(p, needle, needle_len) == 0) {
      return true;
    }
  }
  return false;
}

bool ShouldLogRegistryPath(const wchar_t* subkey) {
  (void)subkey;
  return true;
}

bool IsTargetGuid(REFGUID guid) {
  return InlineIsEqualGUID(guid, kTargetTypeLib) != 0;
}

void AppendLog(const char* format, ...) {
  if (!g_logReady.load()) {
    return;
  }

  char buffer[1024];
  va_list args;
  va_start(args, format);
  StringCchVPrintfA(buffer, sizeof(buffer), format, args);
  va_end(args);

  SYSTEMTIME st{};
  GetLocalTime(&st);

  char line[1200];
  StringCchPrintfA(
      line,
      sizeof(line),
      "[%04u-%02u-%02u %02u:%02u:%02u.%03u] %s\r\n",
      st.wYear,
      st.wMonth,
      st.wDay,
      st.wHour,
      st.wMinute,
      st.wSecond,
      st.wMilliseconds,
      buffer);

  EnterCriticalSection(&g_logLock);
  HANDLE file = CreateFileW(
      kLogPath,
      FILE_APPEND_DATA,
      FILE_SHARE_READ | FILE_SHARE_WRITE | FILE_SHARE_DELETE,
      nullptr,
      OPEN_ALWAYS,
      FILE_ATTRIBUTE_NORMAL,
      nullptr);
  if (file != INVALID_HANDLE_VALUE) {
    DWORD written = 0;
    WriteFile(file, line, static_cast<DWORD>(strlen(line)), &written, nullptr);
    CloseHandle(file);
  }
  LeaveCriticalSection(&g_logLock);
}

void GuidToAscii(REFGUID guid, char* buffer, size_t cchBuffer) {
  wchar_t wide[64];
  if (StringFromGUID2(guid, wide, ARRAYSIZE(wide)) <= 0) {
    StringCchCopyA(buffer, cchBuffer, "{guid-error}");
    return;
  }
  WideCharToMultiByte(CP_UTF8, 0, wide, -1, buffer, static_cast<int>(cchBuffer), nullptr, nullptr);
}

void __stdcall LogVbaRawCall(const char* name, const DWORD* stack) {
  if (!stack) {
    AppendLog("%s stack=<null>", name ? name : "<null>");
    return;
  }

  char return_location[512];
  DescribeAddress(reinterpret_cast<const void*>(stack[0]), return_location, ARRAYSIZE(return_location));
  AppendLog("%s ret=%s arg1=0x%08lX arg2=0x%08lX arg3=0x%08lX arg4=0x%08lX arg5=0x%08lX arg6=0x%08lX",
            name ? name : "<null>",
            return_location,
            static_cast<unsigned long>(stack[1]),
            static_cast<unsigned long>(stack[2]),
            static_cast<unsigned long>(stack[3]),
            static_cast<unsigned long>(stack[4]),
            static_cast<unsigned long>(stack[5]),
            static_cast<unsigned long>(stack[6]));
}

void DescribeAddress(const void* address, char* buffer, size_t cchBuffer) {
  if (!buffer || cchBuffer == 0) {
    return;
  }
  buffer[0] = '\0';
  if (!address) {
    StringCchCopyA(buffer, cchBuffer, "<null>");
    return;
  }

  HMODULE module = nullptr;
  if (!GetModuleHandleExW(GET_MODULE_HANDLE_EX_FLAG_FROM_ADDRESS | GET_MODULE_HANDLE_EX_FLAG_UNCHANGED_REFCOUNT,
                          reinterpret_cast<LPCWSTR>(address),
                          &module)) {
    StringCchPrintfA(buffer, cchBuffer, "%p", address);
    return;
  }

  wchar_t module_path[MAX_PATH];
  if (!GetModuleFileNameW(module, module_path, ARRAYSIZE(module_path))) {
    StringCchPrintfA(buffer, cchBuffer, "%p", address);
    return;
  }

  char module_utf8[MAX_PATH * 2];
  WideToUtf8(module_path, module_utf8, ARRAYSIZE(module_utf8));
  const auto offset = reinterpret_cast<const unsigned char*>(address) - reinterpret_cast<const unsigned char*>(module);
  StringCchPrintfA(buffer, cchBuffer, "%s+0x%lX", module_utf8, static_cast<unsigned long>(offset));
}

void LogStackTrace(const char* prefix) {
  void* frames[16] = {};
  const USHORT captured = CaptureStackBackTrace(1, ARRAYSIZE(frames), frames, nullptr);
  AppendLog("%s stack frames=%u", prefix ? prefix : "stack", static_cast<unsigned>(captured));
  for (USHORT i = 0; i < captured; ++i) {
    char location[512];
    DescribeAddress(frames[i], location, ARRAYSIZE(location));
    AppendLog("  #%u %s", static_cast<unsigned>(i), location);
  }
}

void UnicodeStringToUtf8(const UNICODE_STRING* value, char* buffer, size_t cchBuffer) {
  if (!buffer || cchBuffer == 0) {
    return;
  }
  buffer[0] = '\0';
  if (!value || !value->Buffer || value->Length == 0) {
    StringCchCopyA(buffer, cchBuffer, "<null>");
    return;
  }
  const int char_count = value->Length / sizeof(wchar_t);
  const int written = WideCharToMultiByte(CP_UTF8, 0, value->Buffer, char_count, buffer, static_cast<int>(cchBuffer - 1),
                                          nullptr, nullptr);
  buffer[written >= 0 ? written : 0] = '\0';
}

void AnsiStringToUtf8(const ANSI_STRING* value, char* buffer, size_t cchBuffer) {
  if (!buffer || cchBuffer == 0) {
    return;
  }
  buffer[0] = '\0';
  if (!value || !value->Buffer || value->Length == 0) {
    StringCchCopyA(buffer, cchBuffer, "<null>");
    return;
  }
  const size_t copy_len = min(static_cast<size_t>(value->Length), cchBuffer - 1);
  memcpy(buffer, value->Buffer, copy_len);
  buffer[copy_len] = '\0';
}

void ResetVariantValue(VARIANT* value) {
  if (value) {
    VariantInit(value);
  }
}

void ResetCustDataValue(CUSTDATA* value) {
  if (value) {
    ZeroMemory(value, sizeof(*value));
  }
}

HRESULT GetTypeKindFromInfo(ITypeInfo* type_info, TYPEKIND* pTypeKind) {
  if (!pTypeKind) {
    return E_POINTER;
  }
  *pTypeKind = TKIND_MAX;
  if (!type_info) {
    return E_FAIL;
  }

  TYPEATTR* type_attr = nullptr;
  const HRESULT hr = type_info->GetTypeAttr(&type_attr);
  if (FAILED(hr)) {
    return hr;
  }

  *pTypeKind = type_attr->typekind;
  type_info->ReleaseTypeAttr(type_attr);
  return S_OK;
}

HRESULT GetTypeFlagsFromInfo(ITypeInfo* type_info, ULONG* pTypeFlags) {
  if (!pTypeFlags) {
    return E_POINTER;
  }
  *pTypeFlags = 0;
  if (!type_info) {
    return E_FAIL;
  }

  TYPEATTR* type_attr = nullptr;
  const HRESULT hr = type_info->GetTypeAttr(&type_attr);
  if (FAILED(hr)) {
    return hr;
  }

  *pTypeFlags = static_cast<ULONG>(type_attr->wTypeFlags);
  type_info->ReleaseTypeAttr(type_attr);
  return S_OK;
}

class DummyTypeInfo final : public ITypeInfo2 {
 public:
  DummyTypeInfo(REFGUID guid, ITypeLib* owner) : ref_count_(1), guid_(guid), owner_(owner) {
    if (owner_) {
      owner_->AddRef();
    }
  }

  ~DummyTypeInfo() {
    if (owner_) {
      owner_->Release();
    }
  }

  HRESULT STDMETHODCALLTYPE QueryInterface(REFIID riid, void** ppvObject) override {
    if (!ppvObject) {
      return E_POINTER;
    }
    *ppvObject = nullptr;
    if (riid == IID_IUnknown || riid == IID_ITypeInfo || riid == IID_ITypeInfo2) {
      *ppvObject = static_cast<ITypeInfo2*>(this);
      AddRef();
      return S_OK;
    }
    return E_NOINTERFACE;
  }

  ULONG STDMETHODCALLTYPE AddRef() override {
    return static_cast<ULONG>(++ref_count_);
  }

  ULONG STDMETHODCALLTYPE Release() override {
    const ULONG value = static_cast<ULONG>(--ref_count_);
    if (value == 0) {
      delete this;
    }
    return value;
  }

  HRESULT STDMETHODCALLTYPE GetTypeAttr(TYPEATTR** ppTypeAttr) override {
    if (!ppTypeAttr) {
      return E_POINTER;
    }

    auto* attr = static_cast<TYPEATTR*>(CoTaskMemAlloc(sizeof(TYPEATTR)));
    if (!attr) {
      return E_OUTOFMEMORY;
    }

    ZeroMemory(attr, sizeof(TYPEATTR));
    attr->guid = guid_;
    attr->lcid = 0;
    attr->memidConstructor = MEMBERID_NIL;
    attr->memidDestructor = MEMBERID_NIL;
    attr->cbSizeInstance = 4;
    attr->typekind = TKIND_DISPATCH;
    attr->cFuncs = 0;
    attr->cVars = 0;
    attr->cImplTypes = 0;
    attr->cbSizeVft = 0;
    attr->cbAlignment = 4;
    attr->wTypeFlags = TYPEFLAG_FDUAL | TYPEFLAG_FDISPATCHABLE | TYPEFLAG_FOLEAUTOMATION;
    attr->wMajorVerNum = 1;
    attr->wMinorVerNum = 0;
    attr->tdescAlias.vt = VT_EMPTY;
    attr->idldescType.dwReserved = 0;
    attr->idldescType.wIDLFlags = 0;

    *ppTypeAttr = attr;

    char guid_text[64];
    GuidToAscii(guid_, guid_text, ARRAYSIZE(guid_text));
    AppendLog("DummyTypeInfo::GetTypeAttr %s", guid_text);
    return S_OK;
  }

  HRESULT STDMETHODCALLTYPE GetTypeComp(ITypeComp** ppTComp) override {
    if (ppTComp) {
      *ppTComp = nullptr;
    }
    AppendLog("DummyTypeInfo::GetTypeComp");
    return E_NOTIMPL;
  }

  HRESULT STDMETHODCALLTYPE GetFuncDesc(UINT index, FUNCDESC** ppFuncDesc) override {
    if (ppFuncDesc) {
      *ppFuncDesc = nullptr;
    }
    AppendLog("DummyTypeInfo::GetFuncDesc index=%u", index);
    return TYPE_E_ELEMENTNOTFOUND;
  }

  HRESULT STDMETHODCALLTYPE GetVarDesc(UINT index, VARDESC** ppVarDesc) override {
    if (ppVarDesc) {
      *ppVarDesc = nullptr;
    }
    AppendLog("DummyTypeInfo::GetVarDesc index=%u", index);
    return TYPE_E_ELEMENTNOTFOUND;
  }

  HRESULT STDMETHODCALLTYPE GetNames(MEMBERID memid, BSTR* rgBstrNames, UINT cMaxNames, UINT* pcNames) override {
    if (pcNames) {
      *pcNames = 0;
    }
    if (rgBstrNames && cMaxNames > 0) {
      rgBstrNames[0] = nullptr;
    }
    AppendLog("DummyTypeInfo::GetNames memid=%ld", static_cast<long>(memid));
    return TYPE_E_ELEMENTNOTFOUND;
  }

  HRESULT STDMETHODCALLTYPE GetRefTypeOfImplType(UINT index, HREFTYPE* pRefType) override {
    if (pRefType) {
      *pRefType = 0;
    }
    AppendLog("DummyTypeInfo::GetRefTypeOfImplType index=%u", index);
    return TYPE_E_ELEMENTNOTFOUND;
  }

  HRESULT STDMETHODCALLTYPE GetImplTypeFlags(UINT index, INT* pImplTypeFlags) override {
    if (pImplTypeFlags) {
      *pImplTypeFlags = 0;
    }
    AppendLog("DummyTypeInfo::GetImplTypeFlags index=%u", index);
    return TYPE_E_ELEMENTNOTFOUND;
  }

  HRESULT STDMETHODCALLTYPE GetIDsOfNames(LPOLESTR* rgszNames, UINT cNames, MEMBERID* pMemId) override {
    if (pMemId) {
      *pMemId = MEMBERID_NIL;
    }
    AppendLog("DummyTypeInfo::GetIDsOfNames count=%u", cNames);
    return DISP_E_UNKNOWNNAME;
  }

  HRESULT STDMETHODCALLTYPE Invoke(PVOID pvInstance,
                                   MEMBERID memid,
                                   WORD wFlags,
                                   DISPPARAMS* pDispParams,
                                   VARIANT* pVarResult,
                                   EXCEPINFO* pExcepInfo,
                                   UINT* puArgErr) override {
    AppendLog("DummyTypeInfo::Invoke memid=%ld flags=%u", static_cast<long>(memid), static_cast<unsigned>(wFlags));
    return DISP_E_MEMBERNOTFOUND;
  }

  HRESULT STDMETHODCALLTYPE GetDocumentation(MEMBERID memid,
                                             BSTR* pBstrName,
                                             BSTR* pBstrDocString,
                                             DWORD* pdwHelpContext,
                                             BSTR* pBstrHelpFile) override {
    if (pBstrName) {
      *pBstrName = SysAllocString(L"DummyTypeInfo");
    }
    if (pBstrDocString) {
      *pBstrDocString = SysAllocString(L"Synthetic type info");
    }
    if (pdwHelpContext) {
      *pdwHelpContext = 0;
    }
    if (pBstrHelpFile) {
      *pBstrHelpFile = SysAllocString(L"");
    }
    AppendLog("DummyTypeInfo::GetDocumentation memid=%ld", static_cast<long>(memid));
    return S_OK;
  }

  HRESULT STDMETHODCALLTYPE GetDllEntry(MEMBERID memid,
                                        INVOKEKIND invKind,
                                        BSTR* pBstrDllName,
                                        BSTR* pBstrName,
                                        WORD* pwOrdinal) override {
    if (pBstrDllName) {
      *pBstrDllName = nullptr;
    }
    if (pBstrName) {
      *pBstrName = nullptr;
    }
    if (pwOrdinal) {
      *pwOrdinal = 0;
    }
    AppendLog("DummyTypeInfo::GetDllEntry memid=%ld", static_cast<long>(memid));
    return TYPE_E_BADMODULEKIND;
  }

  HRESULT STDMETHODCALLTYPE GetRefTypeInfo(HREFTYPE hRefType, ITypeInfo** ppTInfo) override {
    if (ppTInfo) {
      *ppTInfo = nullptr;
    }
    AppendLog("DummyTypeInfo::GetRefTypeInfo hreftype=%lu", static_cast<unsigned long>(hRefType));
    return TYPE_E_ELEMENTNOTFOUND;
  }

  HRESULT STDMETHODCALLTYPE AddressOfMember(MEMBERID memid,
                                            INVOKEKIND invKind,
                                            PVOID* ppv) override {
    if (ppv) {
      *ppv = nullptr;
    }
    AppendLog("DummyTypeInfo::AddressOfMember memid=%ld", static_cast<long>(memid));
    return E_NOTIMPL;
  }

  HRESULT STDMETHODCALLTYPE CreateInstance(IUnknown* pUnkOuter, REFIID riid, PVOID* ppvObj) override {
    if (ppvObj) {
      *ppvObj = nullptr;
    }
    AppendLog("DummyTypeInfo::CreateInstance");
    return CLASS_E_CLASSNOTAVAILABLE;
  }

  HRESULT STDMETHODCALLTYPE GetMops(MEMBERID memid, BSTR* pBstrMops) override {
    if (pBstrMops) {
      *pBstrMops = SysAllocString(L"");
    }
    AppendLog("DummyTypeInfo::GetMops memid=%ld", static_cast<long>(memid));
    return S_OK;
  }

  HRESULT STDMETHODCALLTYPE GetContainingTypeLib(ITypeLib** ppTLib, UINT* pIndex) override;

  void STDMETHODCALLTYPE ReleaseTypeAttr(TYPEATTR* pTypeAttr) override {
    AppendLog("DummyTypeInfo::ReleaseTypeAttr");
    CoTaskMemFree(pTypeAttr);
  }

  void STDMETHODCALLTYPE ReleaseFuncDesc(FUNCDESC* pFuncDesc) override {
    AppendLog("DummyTypeInfo::ReleaseFuncDesc");
    CoTaskMemFree(pFuncDesc);
  }

  void STDMETHODCALLTYPE ReleaseVarDesc(VARDESC* pVarDesc) override {
    AppendLog("DummyTypeInfo::ReleaseVarDesc");
    CoTaskMemFree(pVarDesc);
  }

  HRESULT STDMETHODCALLTYPE GetTypeKind(TYPEKIND* pTypeKind) override {
    if (!pTypeKind) {
      return E_POINTER;
    }
    *pTypeKind = TKIND_DISPATCH;
    AppendLog("DummyTypeInfo::GetTypeKind");
    return S_OK;
  }

  HRESULT STDMETHODCALLTYPE GetTypeFlags(ULONG* pTypeFlags) override {
    if (!pTypeFlags) {
      return E_POINTER;
    }
    *pTypeFlags = TYPEFLAG_FDUAL | TYPEFLAG_FDISPATCHABLE | TYPEFLAG_FOLEAUTOMATION;
    AppendLog("DummyTypeInfo::GetTypeFlags");
    return S_OK;
  }

  HRESULT STDMETHODCALLTYPE GetFuncIndexOfMemId(MEMBERID memid, INVOKEKIND invKind, UINT* pFuncIndex) override {
    if (pFuncIndex) {
      *pFuncIndex = 0;
    }
    AppendLog("DummyTypeInfo::GetFuncIndexOfMemId memid=%ld invkind=%u", static_cast<long>(memid), static_cast<unsigned>(invKind));
    return TYPE_E_ELEMENTNOTFOUND;
  }

  HRESULT STDMETHODCALLTYPE GetVarIndexOfMemId(MEMBERID memid, UINT* pVarIndex) override {
    if (pVarIndex) {
      *pVarIndex = 0;
    }
    AppendLog("DummyTypeInfo::GetVarIndexOfMemId memid=%ld", static_cast<long>(memid));
    return TYPE_E_ELEMENTNOTFOUND;
  }

  HRESULT STDMETHODCALLTYPE GetCustData(REFGUID guid, VARIANT* pVarVal) override {
    ResetVariantValue(pVarVal);
    char guid_text[64];
    GuidToAscii(guid, guid_text, ARRAYSIZE(guid_text));
    AppendLog("DummyTypeInfo::GetCustData guid=%s", guid_text);
    return TYPE_E_ELEMENTNOTFOUND;
  }

  HRESULT STDMETHODCALLTYPE GetFuncCustData(UINT index, REFGUID guid, VARIANT* pVarVal) override {
    ResetVariantValue(pVarVal);
    char guid_text[64];
    GuidToAscii(guid, guid_text, ARRAYSIZE(guid_text));
    AppendLog("DummyTypeInfo::GetFuncCustData index=%u guid=%s", index, guid_text);
    return TYPE_E_ELEMENTNOTFOUND;
  }

  HRESULT STDMETHODCALLTYPE GetParamCustData(UINT indexFunc, UINT indexParam, REFGUID guid, VARIANT* pVarVal) override {
    ResetVariantValue(pVarVal);
    char guid_text[64];
    GuidToAscii(guid, guid_text, ARRAYSIZE(guid_text));
    AppendLog("DummyTypeInfo::GetParamCustData func=%u param=%u guid=%s", indexFunc, indexParam, guid_text);
    return TYPE_E_ELEMENTNOTFOUND;
  }

  HRESULT STDMETHODCALLTYPE GetVarCustData(UINT index, REFGUID guid, VARIANT* pVarVal) override {
    ResetVariantValue(pVarVal);
    char guid_text[64];
    GuidToAscii(guid, guid_text, ARRAYSIZE(guid_text));
    AppendLog("DummyTypeInfo::GetVarCustData index=%u guid=%s", index, guid_text);
    return TYPE_E_ELEMENTNOTFOUND;
  }

  HRESULT STDMETHODCALLTYPE GetImplTypeCustData(UINT index, REFGUID guid, VARIANT* pVarVal) override {
    ResetVariantValue(pVarVal);
    char guid_text[64];
    GuidToAscii(guid, guid_text, ARRAYSIZE(guid_text));
    AppendLog("DummyTypeInfo::GetImplTypeCustData index=%u guid=%s", index, guid_text);
    return TYPE_E_ELEMENTNOTFOUND;
  }

  HRESULT STDMETHODCALLTYPE GetDocumentation2(MEMBERID memid,
                                              LCID lcid,
                                              BSTR* pbstrHelpString,
                                              DWORD* pdwHelpStringContext,
                                              BSTR* pbstrHelpStringDll) override {
    if (pbstrHelpString) {
      *pbstrHelpString = SysAllocString(L"");
    }
    if (pdwHelpStringContext) {
      *pdwHelpStringContext = 0;
    }
    if (pbstrHelpStringDll) {
      *pbstrHelpStringDll = SysAllocString(L"");
    }
    AppendLog("DummyTypeInfo::GetDocumentation2 memid=%ld lcid=%lu", static_cast<long>(memid), static_cast<unsigned long>(lcid));
    return S_OK;
  }

  HRESULT STDMETHODCALLTYPE GetAllCustData(CUSTDATA* pCustData) override {
    ResetCustDataValue(pCustData);
    AppendLog("DummyTypeInfo::GetAllCustData");
    return S_OK;
  }

  HRESULT STDMETHODCALLTYPE GetAllFuncCustData(UINT index, CUSTDATA* pCustData) override {
    ResetCustDataValue(pCustData);
    AppendLog("DummyTypeInfo::GetAllFuncCustData index=%u", index);
    return S_OK;
  }

  HRESULT STDMETHODCALLTYPE GetAllParamCustData(UINT indexFunc, UINT indexParam, CUSTDATA* pCustData) override {
    ResetCustDataValue(pCustData);
    AppendLog("DummyTypeInfo::GetAllParamCustData func=%u param=%u", indexFunc, indexParam);
    return S_OK;
  }

  HRESULT STDMETHODCALLTYPE GetAllVarCustData(UINT index, CUSTDATA* pCustData) override {
    ResetCustDataValue(pCustData);
    AppendLog("DummyTypeInfo::GetAllVarCustData index=%u", index);
    return S_OK;
  }

  HRESULT STDMETHODCALLTYPE GetAllImplTypeCustData(UINT index, CUSTDATA* pCustData) override {
    ResetCustDataValue(pCustData);
    AppendLog("DummyTypeInfo::GetAllImplTypeCustData index=%u", index);
    return S_OK;
  }

 private:
  std::atomic<long> ref_count_;
  GUID guid_;
  ITypeLib* owner_;
};

class LoggedTypeInfo final : public ITypeInfo2 {
 public:
  explicit LoggedTypeInfo(ITypeInfo* backing) : ref_count_(1), backing_(backing), backing2_(nullptr) {
    if (backing_) {
      backing_->AddRef();
      backing_->QueryInterface(IID_ITypeInfo2, reinterpret_cast<void**>(&backing2_));
    }
  }

  ~LoggedTypeInfo() {
    if (backing2_) {
      backing2_->Release();
    }
    if (backing_) {
      backing_->Release();
    }
  }

  HRESULT STDMETHODCALLTYPE QueryInterface(REFIID riid, void** ppvObject) override {
    if (!ppvObject) {
      return E_POINTER;
    }
    *ppvObject = nullptr;
    char iid_text[64];
    GuidToAscii(riid, iid_text, ARRAYSIZE(iid_text));
    if (riid == IID_IUnknown || riid == IID_ITypeInfo || riid == IID_ITypeInfo2) {
      *ppvObject = static_cast<ITypeInfo2*>(this);
      AddRef();
      AppendLog("LoggedTypeInfo::QueryInterface iid=%s -> self", iid_text);
      return S_OK;
    }
    const HRESULT hr = backing_ ? backing_->QueryInterface(riid, ppvObject) : E_NOINTERFACE;
    AppendLog("LoggedTypeInfo::QueryInterface iid=%s -> backing hr=0x%08lX",
              iid_text,
              static_cast<unsigned long>(hr));
    return hr;
  }

  ULONG STDMETHODCALLTYPE AddRef() override {
    return static_cast<ULONG>(++ref_count_);
  }

  ULONG STDMETHODCALLTYPE Release() override {
    const ULONG value = static_cast<ULONG>(--ref_count_);
    if (value == 0) {
      delete this;
    }
    return value;
  }

  HRESULT STDMETHODCALLTYPE GetTypeAttr(TYPEATTR** ppTypeAttr) override {
    const HRESULT hr = backing_ ? backing_->GetTypeAttr(ppTypeAttr) : E_FAIL;
    if (SUCCEEDED(hr) && ppTypeAttr && *ppTypeAttr) {
      char guid_text[64];
      GuidToAscii((*ppTypeAttr)->guid, guid_text, ARRAYSIZE(guid_text));
      AppendLog(
          "LoggedTypeInfo::GetTypeAttr hr=0x%08lX guid=%s typekind=%d cFuncs=%u cVars=%u cImplTypes=%u flags=0x%04X",
          static_cast<unsigned long>(hr),
          guid_text,
          static_cast<int>((*ppTypeAttr)->typekind),
          static_cast<unsigned>((*ppTypeAttr)->cFuncs),
          static_cast<unsigned>((*ppTypeAttr)->cVars),
          static_cast<unsigned>((*ppTypeAttr)->cImplTypes),
          static_cast<unsigned>((*ppTypeAttr)->wTypeFlags));
    } else {
      AppendLog("LoggedTypeInfo::GetTypeAttr hr=0x%08lX", static_cast<unsigned long>(hr));
    }
    return hr;
  }

  HRESULT STDMETHODCALLTYPE GetTypeComp(ITypeComp** ppTComp) override {
    const HRESULT hr = backing_ ? backing_->GetTypeComp(ppTComp) : E_FAIL;
    AppendLog("LoggedTypeInfo::GetTypeComp hr=0x%08lX", static_cast<unsigned long>(hr));
    return hr;
  }

  HRESULT STDMETHODCALLTYPE GetFuncDesc(UINT index, FUNCDESC** ppFuncDesc) override {
    const HRESULT hr = backing_ ? backing_->GetFuncDesc(index, ppFuncDesc) : E_FAIL;
    AppendLog("LoggedTypeInfo::GetFuncDesc index=%u hr=0x%08lX", index, static_cast<unsigned long>(hr));
    return hr;
  }

  HRESULT STDMETHODCALLTYPE GetVarDesc(UINT index, VARDESC** ppVarDesc) override {
    const HRESULT hr = backing_ ? backing_->GetVarDesc(index, ppVarDesc) : E_FAIL;
    AppendLog("LoggedTypeInfo::GetVarDesc index=%u hr=0x%08lX", index, static_cast<unsigned long>(hr));
    return hr;
  }

  HRESULT STDMETHODCALLTYPE GetNames(MEMBERID memid, BSTR* rgBstrNames, UINT cMaxNames, UINT* pcNames) override {
    const HRESULT hr = backing_ ? backing_->GetNames(memid, rgBstrNames, cMaxNames, pcNames) : E_FAIL;
    AppendLog("LoggedTypeInfo::GetNames memid=%ld hr=0x%08lX", static_cast<long>(memid), static_cast<unsigned long>(hr));
    return hr;
  }

  HRESULT STDMETHODCALLTYPE GetRefTypeOfImplType(UINT index, HREFTYPE* pRefType) override {
    const HRESULT hr = backing_ ? backing_->GetRefTypeOfImplType(index, pRefType) : E_FAIL;
    AppendLog("LoggedTypeInfo::GetRefTypeOfImplType index=%u hr=0x%08lX", index, static_cast<unsigned long>(hr));
    return hr;
  }

  HRESULT STDMETHODCALLTYPE GetImplTypeFlags(UINT index, INT* pImplTypeFlags) override {
    const HRESULT hr = backing_ ? backing_->GetImplTypeFlags(index, pImplTypeFlags) : E_FAIL;
    AppendLog("LoggedTypeInfo::GetImplTypeFlags index=%u hr=0x%08lX", index, static_cast<unsigned long>(hr));
    return hr;
  }

  HRESULT STDMETHODCALLTYPE GetIDsOfNames(LPOLESTR* rgszNames, UINT cNames, MEMBERID* pMemId) override {
    const HRESULT hr = backing_ ? backing_->GetIDsOfNames(rgszNames, cNames, pMemId) : E_FAIL;
    AppendLog("LoggedTypeInfo::GetIDsOfNames count=%u hr=0x%08lX", cNames, static_cast<unsigned long>(hr));
    return hr;
  }

  HRESULT STDMETHODCALLTYPE Invoke(PVOID pvInstance,
                                   MEMBERID memid,
                                   WORD wFlags,
                                   DISPPARAMS* pDispParams,
                                   VARIANT* pVarResult,
                                   EXCEPINFO* pExcepInfo,
                                   UINT* puArgErr) override {
    const HRESULT hr = backing_ ? backing_->Invoke(pvInstance, memid, wFlags, pDispParams, pVarResult, pExcepInfo, puArgErr)
                                : E_FAIL;
    AppendLog("LoggedTypeInfo::Invoke memid=%ld flags=%u hr=0x%08lX",
              static_cast<long>(memid),
              static_cast<unsigned>(wFlags),
              static_cast<unsigned long>(hr));
    return hr;
  }

  HRESULT STDMETHODCALLTYPE GetDocumentation(MEMBERID memid,
                                             BSTR* pBstrName,
                                             BSTR* pBstrDocString,
                                             DWORD* pdwHelpContext,
                                             BSTR* pBstrHelpFile) override {
    const HRESULT hr = backing_ ? backing_->GetDocumentation(memid, pBstrName, pBstrDocString, pdwHelpContext, pBstrHelpFile)
                                : E_FAIL;
    AppendLog("LoggedTypeInfo::GetDocumentation memid=%ld hr=0x%08lX",
              static_cast<long>(memid),
              static_cast<unsigned long>(hr));
    return hr;
  }

  HRESULT STDMETHODCALLTYPE GetDllEntry(MEMBERID memid,
                                        INVOKEKIND invKind,
                                        BSTR* pBstrDllName,
                                        BSTR* pBstrName,
                                        WORD* pwOrdinal) override {
    const HRESULT hr = backing_ ? backing_->GetDllEntry(memid, invKind, pBstrDllName, pBstrName, pwOrdinal) : E_FAIL;
    AppendLog("LoggedTypeInfo::GetDllEntry memid=%ld hr=0x%08lX", static_cast<long>(memid), static_cast<unsigned long>(hr));
    return hr;
  }

  HRESULT STDMETHODCALLTYPE GetRefTypeInfo(HREFTYPE hRefType, ITypeInfo** ppTInfo) override {
    const HRESULT hr = backing_ ? backing_->GetRefTypeInfo(hRefType, ppTInfo) : E_FAIL;
    AppendLog("LoggedTypeInfo::GetRefTypeInfo hreftype=%lu hr=0x%08lX",
              static_cast<unsigned long>(hRefType),
              static_cast<unsigned long>(hr));
    if (SUCCEEDED(hr) && ppTInfo && *ppTInfo) {
      auto* proxy = new (std::nothrow) LoggedTypeInfo(*ppTInfo);
      if (!proxy) {
        return E_OUTOFMEMORY;
      }
      (*ppTInfo)->Release();
      *ppTInfo = proxy;
      AppendLog("LoggedTypeInfo::GetRefTypeInfo wrapped nested typeinfo");
    }
    return hr;
  }

  HRESULT STDMETHODCALLTYPE AddressOfMember(MEMBERID memid,
                                            INVOKEKIND invKind,
                                            PVOID* ppv) override {
    const HRESULT hr = backing_ ? backing_->AddressOfMember(memid, invKind, ppv) : E_FAIL;
    AppendLog("LoggedTypeInfo::AddressOfMember memid=%ld hr=0x%08lX",
              static_cast<long>(memid),
              static_cast<unsigned long>(hr));
    return hr;
  }

  HRESULT STDMETHODCALLTYPE CreateInstance(IUnknown* pUnkOuter, REFIID riid, PVOID* ppvObj) override {
    const HRESULT hr = backing_ ? backing_->CreateInstance(pUnkOuter, riid, ppvObj) : E_FAIL;
    AppendLog("LoggedTypeInfo::CreateInstance hr=0x%08lX", static_cast<unsigned long>(hr));
    return hr;
  }

  HRESULT STDMETHODCALLTYPE GetMops(MEMBERID memid, BSTR* pBstrMops) override {
    const HRESULT hr = backing_ ? backing_->GetMops(memid, pBstrMops) : E_FAIL;
    AppendLog("LoggedTypeInfo::GetMops memid=%ld hr=0x%08lX", static_cast<long>(memid), static_cast<unsigned long>(hr));
    return hr;
  }

  HRESULT STDMETHODCALLTYPE GetContainingTypeLib(ITypeLib** ppTLib, UINT* pIndex) override {
    const HRESULT hr = backing_ ? backing_->GetContainingTypeLib(ppTLib, pIndex) : E_FAIL;
    AppendLog("LoggedTypeInfo::GetContainingTypeLib hr=0x%08lX", static_cast<unsigned long>(hr));
    return hr;
  }

  void STDMETHODCALLTYPE ReleaseTypeAttr(TYPEATTR* pTypeAttr) override {
    AppendLog("LoggedTypeInfo::ReleaseTypeAttr");
    if (backing_) {
      backing_->ReleaseTypeAttr(pTypeAttr);
    }
  }

  void STDMETHODCALLTYPE ReleaseFuncDesc(FUNCDESC* pFuncDesc) override {
    AppendLog("LoggedTypeInfo::ReleaseFuncDesc");
    if (backing_) {
      backing_->ReleaseFuncDesc(pFuncDesc);
    }
  }

  void STDMETHODCALLTYPE ReleaseVarDesc(VARDESC* pVarDesc) override {
    AppendLog("LoggedTypeInfo::ReleaseVarDesc");
    if (backing_) {
      backing_->ReleaseVarDesc(pVarDesc);
    }
  }

  HRESULT STDMETHODCALLTYPE GetTypeKind(TYPEKIND* pTypeKind) override {
    const HRESULT hr = backing2_ ? backing2_->GetTypeKind(pTypeKind) : GetTypeKindFromInfo(backing_, pTypeKind);
    AppendLog("LoggedTypeInfo::GetTypeKind hr=0x%08lX", static_cast<unsigned long>(hr));
    return hr;
  }

  HRESULT STDMETHODCALLTYPE GetTypeFlags(ULONG* pTypeFlags) override {
    const HRESULT hr = backing2_ ? backing2_->GetTypeFlags(pTypeFlags) : GetTypeFlagsFromInfo(backing_, pTypeFlags);
    AppendLog("LoggedTypeInfo::GetTypeFlags hr=0x%08lX", static_cast<unsigned long>(hr));
    return hr;
  }

  HRESULT STDMETHODCALLTYPE GetFuncIndexOfMemId(MEMBERID memid, INVOKEKIND invKind, UINT* pFuncIndex) override {
    const HRESULT hr = backing2_ ? backing2_->GetFuncIndexOfMemId(memid, invKind, pFuncIndex) : E_NOTIMPL;
    AppendLog("LoggedTypeInfo::GetFuncIndexOfMemId memid=%ld invkind=%u hr=0x%08lX",
              static_cast<long>(memid),
              static_cast<unsigned>(invKind),
              static_cast<unsigned long>(hr));
    return hr;
  }

  HRESULT STDMETHODCALLTYPE GetVarIndexOfMemId(MEMBERID memid, UINT* pVarIndex) override {
    const HRESULT hr = backing2_ ? backing2_->GetVarIndexOfMemId(memid, pVarIndex) : E_NOTIMPL;
    AppendLog("LoggedTypeInfo::GetVarIndexOfMemId memid=%ld hr=0x%08lX", static_cast<long>(memid), static_cast<unsigned long>(hr));
    return hr;
  }

  HRESULT STDMETHODCALLTYPE GetCustData(REFGUID guid, VARIANT* pVarVal) override {
    if (!backing2_) {
      ResetVariantValue(pVarVal);
    }
    const HRESULT hr = backing2_ ? backing2_->GetCustData(guid, pVarVal) : TYPE_E_ELEMENTNOTFOUND;
    char guid_text[64];
    GuidToAscii(guid, guid_text, ARRAYSIZE(guid_text));
    AppendLog("LoggedTypeInfo::GetCustData guid=%s hr=0x%08lX", guid_text, static_cast<unsigned long>(hr));
    return hr;
  }

  HRESULT STDMETHODCALLTYPE GetFuncCustData(UINT index, REFGUID guid, VARIANT* pVarVal) override {
    if (!backing2_) {
      ResetVariantValue(pVarVal);
    }
    const HRESULT hr = backing2_ ? backing2_->GetFuncCustData(index, guid, pVarVal) : TYPE_E_ELEMENTNOTFOUND;
    char guid_text[64];
    GuidToAscii(guid, guid_text, ARRAYSIZE(guid_text));
    AppendLog("LoggedTypeInfo::GetFuncCustData index=%u guid=%s hr=0x%08lX",
              index,
              guid_text,
              static_cast<unsigned long>(hr));
    return hr;
  }

  HRESULT STDMETHODCALLTYPE GetParamCustData(UINT indexFunc, UINT indexParam, REFGUID guid, VARIANT* pVarVal) override {
    if (!backing2_) {
      ResetVariantValue(pVarVal);
    }
    const HRESULT hr = backing2_ ? backing2_->GetParamCustData(indexFunc, indexParam, guid, pVarVal) : TYPE_E_ELEMENTNOTFOUND;
    char guid_text[64];
    GuidToAscii(guid, guid_text, ARRAYSIZE(guid_text));
    AppendLog("LoggedTypeInfo::GetParamCustData func=%u param=%u guid=%s hr=0x%08lX",
              indexFunc,
              indexParam,
              guid_text,
              static_cast<unsigned long>(hr));
    return hr;
  }

  HRESULT STDMETHODCALLTYPE GetVarCustData(UINT index, REFGUID guid, VARIANT* pVarVal) override {
    if (!backing2_) {
      ResetVariantValue(pVarVal);
    }
    const HRESULT hr = backing2_ ? backing2_->GetVarCustData(index, guid, pVarVal) : TYPE_E_ELEMENTNOTFOUND;
    char guid_text[64];
    GuidToAscii(guid, guid_text, ARRAYSIZE(guid_text));
    AppendLog("LoggedTypeInfo::GetVarCustData index=%u guid=%s hr=0x%08lX",
              index,
              guid_text,
              static_cast<unsigned long>(hr));
    return hr;
  }

  HRESULT STDMETHODCALLTYPE GetImplTypeCustData(UINT index, REFGUID guid, VARIANT* pVarVal) override {
    if (!backing2_) {
      ResetVariantValue(pVarVal);
    }
    const HRESULT hr = backing2_ ? backing2_->GetImplTypeCustData(index, guid, pVarVal) : TYPE_E_ELEMENTNOTFOUND;
    char guid_text[64];
    GuidToAscii(guid, guid_text, ARRAYSIZE(guid_text));
    AppendLog("LoggedTypeInfo::GetImplTypeCustData index=%u guid=%s hr=0x%08lX",
              index,
              guid_text,
              static_cast<unsigned long>(hr));
    return hr;
  }

  HRESULT STDMETHODCALLTYPE GetDocumentation2(MEMBERID memid,
                                              LCID lcid,
                                              BSTR* pbstrHelpString,
                                              DWORD* pdwHelpStringContext,
                                              BSTR* pbstrHelpStringDll) override {
    if (!backing2_) {
      if (pbstrHelpString) {
        *pbstrHelpString = SysAllocString(L"");
      }
      if (pdwHelpStringContext) {
        *pdwHelpStringContext = 0;
      }
      if (pbstrHelpStringDll) {
        *pbstrHelpStringDll = SysAllocString(L"");
      }
    }
    const HRESULT hr = backing2_ ? backing2_->GetDocumentation2(memid, lcid, pbstrHelpString, pdwHelpStringContext, pbstrHelpStringDll)
                                 : S_OK;
    AppendLog("LoggedTypeInfo::GetDocumentation2 memid=%ld lcid=%lu hr=0x%08lX",
              static_cast<long>(memid),
              static_cast<unsigned long>(lcid),
              static_cast<unsigned long>(hr));
    return hr;
  }

  HRESULT STDMETHODCALLTYPE GetAllCustData(CUSTDATA* pCustData) override {
    if (!backing2_) {
      ResetCustDataValue(pCustData);
    }
    const HRESULT hr = backing2_ ? backing2_->GetAllCustData(pCustData) : S_OK;
    AppendLog("LoggedTypeInfo::GetAllCustData hr=0x%08lX", static_cast<unsigned long>(hr));
    return hr;
  }

  HRESULT STDMETHODCALLTYPE GetAllFuncCustData(UINT index, CUSTDATA* pCustData) override {
    if (!backing2_) {
      ResetCustDataValue(pCustData);
    }
    const HRESULT hr = backing2_ ? backing2_->GetAllFuncCustData(index, pCustData) : S_OK;
    AppendLog("LoggedTypeInfo::GetAllFuncCustData index=%u hr=0x%08lX", index, static_cast<unsigned long>(hr));
    return hr;
  }

  HRESULT STDMETHODCALLTYPE GetAllParamCustData(UINT indexFunc, UINT indexParam, CUSTDATA* pCustData) override {
    if (!backing2_) {
      ResetCustDataValue(pCustData);
    }
    const HRESULT hr = backing2_ ? backing2_->GetAllParamCustData(indexFunc, indexParam, pCustData) : S_OK;
    AppendLog("LoggedTypeInfo::GetAllParamCustData func=%u param=%u hr=0x%08lX",
              indexFunc,
              indexParam,
              static_cast<unsigned long>(hr));
    return hr;
  }

  HRESULT STDMETHODCALLTYPE GetAllVarCustData(UINT index, CUSTDATA* pCustData) override {
    if (!backing2_) {
      ResetCustDataValue(pCustData);
    }
    const HRESULT hr = backing2_ ? backing2_->GetAllVarCustData(index, pCustData) : S_OK;
    AppendLog("LoggedTypeInfo::GetAllVarCustData index=%u hr=0x%08lX", index, static_cast<unsigned long>(hr));
    return hr;
  }

  HRESULT STDMETHODCALLTYPE GetAllImplTypeCustData(UINT index, CUSTDATA* pCustData) override {
    if (!backing2_) {
      ResetCustDataValue(pCustData);
    }
    const HRESULT hr = backing2_ ? backing2_->GetAllImplTypeCustData(index, pCustData) : S_OK;
    AppendLog("LoggedTypeInfo::GetAllImplTypeCustData index=%u hr=0x%08lX", index, static_cast<unsigned long>(hr));
    return hr;
  }

 private:
  std::atomic<long> ref_count_;
  ITypeInfo* backing_;
  ITypeInfo2* backing2_;
};

class LoggedTypeLib final : public ITypeLib2 {
 public:
  explicit LoggedTypeLib(ITypeLib* backing) : ref_count_(1), backing_(backing), backing2_(nullptr) {
    if (backing_) {
      backing_->AddRef();
      backing_->QueryInterface(IID_ITypeLib2, reinterpret_cast<void**>(&backing2_));
    }
  }

  ~LoggedTypeLib() {
    if (backing2_) {
      backing2_->Release();
    }
    if (backing_) {
      backing_->Release();
    }
  }

  HRESULT STDMETHODCALLTYPE QueryInterface(REFIID riid, void** ppvObject) override {
    if (!ppvObject) {
      return E_POINTER;
    }
    *ppvObject = nullptr;
    char iid_text[64];
    GuidToAscii(riid, iid_text, ARRAYSIZE(iid_text));
    if (riid == IID_IUnknown || riid == IID_ITypeLib || riid == IID_ITypeLib2) {
      *ppvObject = static_cast<ITypeLib2*>(this);
      AddRef();
      AppendLog("LoggedTypeLib::QueryInterface iid=%s -> self", iid_text);
      return S_OK;
    }
    const HRESULT hr = backing_ ? backing_->QueryInterface(riid, ppvObject) : E_NOINTERFACE;
    AppendLog("LoggedTypeLib::QueryInterface iid=%s -> backing hr=0x%08lX",
              iid_text,
              static_cast<unsigned long>(hr));
    return hr;
  }

  ULONG STDMETHODCALLTYPE AddRef() override {
    return static_cast<ULONG>(++ref_count_);
  }

  ULONG STDMETHODCALLTYPE Release() override {
    const ULONG value = static_cast<ULONG>(--ref_count_);
    if (value == 0) {
      delete this;
    }
    return value;
  }

  UINT STDMETHODCALLTYPE GetTypeInfoCount() override {
    const UINT count = backing_ ? backing_->GetTypeInfoCount() : 0;
    AppendLog("LoggedTypeLib::GetTypeInfoCount -> %u", count);
    return count;
  }

  HRESULT STDMETHODCALLTYPE GetTypeInfo(UINT index, ITypeInfo** ppTInfo) override {
    const HRESULT hr = backing_ ? backing_->GetTypeInfo(index, ppTInfo) : E_FAIL;
    AppendLog("LoggedTypeLib::GetTypeInfo index=%u hr=0x%08lX", index, static_cast<unsigned long>(hr));
    if (SUCCEEDED(hr) && ppTInfo && *ppTInfo) {
      auto* proxy = new (std::nothrow) LoggedTypeInfo(*ppTInfo);
      if (!proxy) {
        return E_OUTOFMEMORY;
      }
      (*ppTInfo)->Release();
      *ppTInfo = proxy;
      AppendLog("LoggedTypeLib::GetTypeInfo wrapped typeinfo");
    }
    return hr;
  }

  HRESULT STDMETHODCALLTYPE GetTypeInfoType(UINT index, TYPEKIND* pTKind) override {
    const HRESULT hr = backing_ ? backing_->GetTypeInfoType(index, pTKind) : E_FAIL;
    AppendLog("LoggedTypeLib::GetTypeInfoType index=%u hr=0x%08lX", index, static_cast<unsigned long>(hr));
    return hr;
  }

  HRESULT STDMETHODCALLTYPE GetTypeInfoOfGuid(REFGUID guid, ITypeInfo** ppTInfo) override {
    if (!ppTInfo) {
      return E_POINTER;
    }

    *ppTInfo = nullptr;

    char guid_text[64];
    GuidToAscii(guid, guid_text, ARRAYSIZE(guid_text));

    HRESULT hr = backing_ ? backing_->GetTypeInfoOfGuid(guid, ppTInfo) : E_FAIL;
    AppendLog("LoggedTypeLib::GetTypeInfoOfGuid guid=%s hr=0x%08lX", guid_text, static_cast<unsigned long>(hr));

    if (FAILED(hr)) {
      auto* dummy = new (std::nothrow) DummyTypeInfo(guid, this);
      if (!dummy) {
        return E_OUTOFMEMORY;
      }
      *ppTInfo = dummy;
      AppendLog("LoggedTypeLib::GetTypeInfoOfGuid guid=%s synthetic=1", guid_text);
      return S_OK;
    }

    if (ppTInfo && *ppTInfo) {
      auto* proxy = new (std::nothrow) LoggedTypeInfo(*ppTInfo);
      if (!proxy) {
        return E_OUTOFMEMORY;
      }
      (*ppTInfo)->Release();
      *ppTInfo = proxy;
      AppendLog("LoggedTypeLib::GetTypeInfoOfGuid guid=%s wrapped=1", guid_text);
    }

    return hr;
  }

  HRESULT STDMETHODCALLTYPE GetLibAttr(TLIBATTR** ppTLibAttr) override {
    const HRESULT hr = backing_ ? backing_->GetLibAttr(ppTLibAttr) : E_FAIL;
    AppendLog("LoggedTypeLib::GetLibAttr hr=0x%08lX", static_cast<unsigned long>(hr));
    return hr;
  }

  HRESULT STDMETHODCALLTYPE GetTypeComp(ITypeComp** ppTComp) override {
    const HRESULT hr = backing_ ? backing_->GetTypeComp(ppTComp) : E_FAIL;
    AppendLog("LoggedTypeLib::GetTypeComp hr=0x%08lX", static_cast<unsigned long>(hr));
    return hr;
  }

  HRESULT STDMETHODCALLTYPE GetDocumentation(INT index,
                                             BSTR* pBstrName,
                                             BSTR* pBstrDocString,
                                             DWORD* pdwHelpContext,
                                             BSTR* pBstrHelpFile) override {
    const HRESULT hr =
        backing_ ? backing_->GetDocumentation(index, pBstrName, pBstrDocString, pdwHelpContext, pBstrHelpFile) : E_FAIL;
    AppendLog("LoggedTypeLib::GetDocumentation index=%d hr=0x%08lX", index, static_cast<unsigned long>(hr));
    return hr;
  }

  HRESULT STDMETHODCALLTYPE IsName(LPOLESTR szNameBuf, ULONG lHashVal, BOOL* pfName) override {
    const HRESULT hr = backing_ ? backing_->IsName(szNameBuf, lHashVal, pfName) : E_FAIL;
    AppendLog("LoggedTypeLib::IsName hr=0x%08lX", static_cast<unsigned long>(hr));
    return hr;
  }

  HRESULT STDMETHODCALLTYPE FindName(LPOLESTR szNameBuf,
                                     ULONG lHashVal,
                                     ITypeInfo** ppTInfo,
                                     MEMBERID* rgMemId,
                                     USHORT* pcFound) override {
    const HRESULT hr = backing_ ? backing_->FindName(szNameBuf, lHashVal, ppTInfo, rgMemId, pcFound) : E_FAIL;
    AppendLog("LoggedTypeLib::FindName hr=0x%08lX", static_cast<unsigned long>(hr));
    if (SUCCEEDED(hr) && ppTInfo && pcFound) {
      for (USHORT i = 0; i < *pcFound; ++i) {
        if (!ppTInfo[i]) {
          continue;
        }
        auto* proxy = new (std::nothrow) LoggedTypeInfo(ppTInfo[i]);
        if (!proxy) {
          return E_OUTOFMEMORY;
        }
        ppTInfo[i]->Release();
        ppTInfo[i] = proxy;
      }
    }
    return hr;
  }

  void STDMETHODCALLTYPE ReleaseTLibAttr(TLIBATTR* pTLibAttr) override {
    AppendLog("LoggedTypeLib::ReleaseTLibAttr");
    if (backing_) {
      backing_->ReleaseTLibAttr(pTLibAttr);
    }
  }

  HRESULT STDMETHODCALLTYPE GetCustData(REFGUID guid, VARIANT* pVarVal) override {
    if (!backing2_) {
      ResetVariantValue(pVarVal);
    }
    const HRESULT hr = backing2_ ? backing2_->GetCustData(guid, pVarVal) : TYPE_E_ELEMENTNOTFOUND;
    char guid_text[64];
    GuidToAscii(guid, guid_text, ARRAYSIZE(guid_text));
    AppendLog("LoggedTypeLib::GetCustData guid=%s hr=0x%08lX", guid_text, static_cast<unsigned long>(hr));
    return hr;
  }

  HRESULT STDMETHODCALLTYPE GetLibStatistics(ULONG* pcUniqueNames, ULONG* pcchUniqueNames) override {
    if (!backing2_) {
      if (pcUniqueNames) {
        *pcUniqueNames = 0;
      }
      if (pcchUniqueNames) {
        *pcchUniqueNames = 0;
      }
    }
    const HRESULT hr = backing2_ ? backing2_->GetLibStatistics(pcUniqueNames, pcchUniqueNames) : S_OK;
    AppendLog("LoggedTypeLib::GetLibStatistics hr=0x%08lX", static_cast<unsigned long>(hr));
    return hr;
  }

  HRESULT STDMETHODCALLTYPE GetDocumentation2(INT index,
                                              LCID lcid,
                                              BSTR* pbstrHelpString,
                                              DWORD* pdwHelpStringContext,
                                              BSTR* pbstrHelpStringDll) override {
    if (!backing2_) {
      if (pbstrHelpString) {
        *pbstrHelpString = SysAllocString(L"");
      }
      if (pdwHelpStringContext) {
        *pdwHelpStringContext = 0;
      }
      if (pbstrHelpStringDll) {
        *pbstrHelpStringDll = SysAllocString(L"");
      }
    }
    const HRESULT hr =
        backing2_ ? backing2_->GetDocumentation2(index, lcid, pbstrHelpString, pdwHelpStringContext, pbstrHelpStringDll) : S_OK;
    AppendLog("LoggedTypeLib::GetDocumentation2 index=%d lcid=%lu hr=0x%08lX",
              index,
              static_cast<unsigned long>(lcid),
              static_cast<unsigned long>(hr));
    return hr;
  }

  HRESULT STDMETHODCALLTYPE GetAllCustData(CUSTDATA* pCustData) override {
    if (!backing2_) {
      ResetCustDataValue(pCustData);
    }
    const HRESULT hr = backing2_ ? backing2_->GetAllCustData(pCustData) : S_OK;
    AppendLog("LoggedTypeLib::GetAllCustData hr=0x%08lX", static_cast<unsigned long>(hr));
    return hr;
  }

 private:
  std::atomic<long> ref_count_;
  ITypeLib* backing_;
  ITypeLib2* backing2_;
};

HRESULT DummyTypeInfo::GetContainingTypeLib(ITypeLib** ppTLib, UINT* pIndex) {
  if (ppTLib) {
    *ppTLib = owner_;
    if (owner_) {
      owner_->AddRef();
    }
  }
  if (pIndex) {
    *pIndex = 0;
  }
  AppendLog("DummyTypeInfo::GetContainingTypeLib");
  return S_OK;
}

HRESULT EnsurePlaceholderLoaded() {
  if (g_placeholder) {
    return S_OK;
  }

  ITypeLib* loaded = nullptr;
  const HRESULT hr = g_originalLoadTypeLibEx ? g_originalLoadTypeLibEx(kPlaceholderPath, REGKIND_NONE, &loaded)
                                             : LoadTypeLibEx(kPlaceholderPath, REGKIND_NONE, &loaded);
  AppendLog("LoadTypeLibEx placeholder hr=0x%08lX", static_cast<unsigned long>(hr));
  if (FAILED(hr)) {
    return hr;
  }

  g_placeholder = loaded;
  return S_OK;
}

bool InstallOneHook(HMODULE module, const char* export_name, void* replacement, void** original_out) {
  auto* target = reinterpret_cast<unsigned char*>(GetProcAddress(module, export_name));
  if (!target) {
    AppendLog("%s export not found", export_name);
    return false;
  }

  unsigned char original[5];
  memcpy(original, target, sizeof(original));

  auto* trampoline = reinterpret_cast<unsigned char*>(
      VirtualAlloc(nullptr, 10, MEM_COMMIT | MEM_RESERVE, PAGE_EXECUTE_READWRITE));
  if (!trampoline) {
    AppendLog("VirtualAlloc trampoline failed for %s gle=%lu", export_name, GetLastError());
    return false;
  }

  memcpy(trampoline, original, sizeof(original));
  trampoline[5] = 0xE9;
  *reinterpret_cast<DWORD*>(trampoline + 6) =
      static_cast<DWORD>((target + 5) - (trampoline + 10));

  DWORD old_protect = 0;
  if (!VirtualProtect(target, sizeof(original), PAGE_EXECUTE_READWRITE, &old_protect)) {
    AppendLog("VirtualProtect failed for %s gle=%lu", export_name, GetLastError());
    return false;
  }

  target[0] = 0xE9;
  *reinterpret_cast<DWORD*>(target + 1) =
      static_cast<DWORD>(reinterpret_cast<unsigned char*>(replacement) - (target + 5));

  DWORD ignored = 0;
  VirtualProtect(target, sizeof(original), old_protect, &ignored);
  FlushInstructionCache(GetCurrentProcess(), target, sizeof(original));

  *original_out = trampoline;
  AppendLog("Hook installed for %s", export_name);
  return true;
}

bool InstallInlineHook() {
  HMODULE oleaut = GetModuleHandleW(L"oleaut32.dll");
  HMODULE ole32 = GetModuleHandleW(L"ole32.dll");
  HMODULE msvbvm60 = GetModuleHandleW(L"MSVBVM60.DLL");
  if (!oleaut) {
    AppendLog("oleaut32.dll not loaded");
    return false;
  }

  HMODULE kernelbase = GetModuleHandleW(L"KernelBase.dll");
  HMODULE kernel32 = GetModuleHandleW(L"kernel32.dll");
  HMODULE ntdll = GetModuleHandleW(L"ntdll.dll");

  if (!kernelbase || !kernel32 || !ntdll) {
    AppendLog("kernel modules not loaded kernel32=%p kernelbase=%p ntdll=%p", kernel32, kernelbase, ntdll);
    return false;
  }

  bool ok = true;
  ok &= InstallOneHook(oleaut, "QueryPathOfRegTypeLib", reinterpret_cast<void*>(&HookQueryPathOfRegTypeLib),
                       reinterpret_cast<void**>(&g_originalQueryPathOfRegTypeLib));
  ok &= InstallOneHook(oleaut, "LoadTypeLibEx", reinterpret_cast<void*>(&HookLoadTypeLibEx),
                       reinterpret_cast<void**>(&g_originalLoadTypeLibEx));
  ok &= InstallOneHook(oleaut, "LoadRegTypeLib", reinterpret_cast<void*>(&HookLoadRegTypeLib),
                       reinterpret_cast<void**>(&g_originalLoadRegTypeLib));
  if (ole32) {
    ok &= InstallOneHook(ole32, "CoCreateInstance", reinterpret_cast<void*>(&HookCoCreateInstance),
                         reinterpret_cast<void**>(&g_originalCoCreateInstance));
    ok &= InstallOneHook(ole32, "CoGetClassObject", reinterpret_cast<void*>(&HookCoGetClassObject),
                         reinterpret_cast<void**>(&g_originalCoGetClassObject));
    ok &= InstallOneHook(ole32, "CoCreateInstanceEx", reinterpret_cast<void*>(&HookCoCreateInstanceEx),
                         reinterpret_cast<void**>(&g_originalCoCreateInstanceEx));
    ok &= InstallOneHook(ole32, "CLSIDFromProgID", reinterpret_cast<void*>(&HookCLSIDFromProgID),
                         reinterpret_cast<void**>(&g_originalCLSIDFromProgID));
  } else {
    AppendLog("ole32.dll not loaded");
  }
  if (msvbvm60) {
    ok &= InstallOneHook(msvbvm60, "__vbaHresultCheck", reinterpret_cast<void*>(&HookVbaHresultCheckStub),
                         &g_originalVbaHresultCheck);
    ok &= InstallOneHook(msvbvm60, "__vbaHresultCheckObj", reinterpret_cast<void*>(&HookVbaHresultCheckObjStub),
                         &g_originalVbaHresultCheckObj);
    ok &= InstallOneHook(msvbvm60, "DllFunctionCall", reinterpret_cast<void*>(&HookDllFunctionCallStub),
                         &g_originalDllFunctionCall);
  } else {
    AppendLog("MSVBVM60.DLL not loaded");
  }
  if (kernelbase) {
    ok &= InstallOneHook(kernelbase, "RegOpenKeyExW", reinterpret_cast<void*>(&HookRegOpenKeyExW),
                         reinterpret_cast<void**>(&g_originalRegOpenKeyExW));
    ok &= InstallOneHook(kernelbase, "RegOpenKeyExA", reinterpret_cast<void*>(&HookRegOpenKeyExA),
                         reinterpret_cast<void**>(&g_originalRegOpenKeyExA));
  } else {
    AppendLog("kernelbase registry exports not available");
  }
  ok &= InstallOneHook(kernelbase, "LoadLibraryW", reinterpret_cast<void*>(&HookLoadLibraryW),
                       reinterpret_cast<void**>(&g_originalLoadLibraryW));
  ok &= InstallOneHook(kernelbase, "LoadLibraryA", reinterpret_cast<void*>(&HookLoadLibraryA),
                       reinterpret_cast<void**>(&g_originalLoadLibraryA));
  ok &= InstallOneHook(kernelbase, "LoadLibraryExW", reinterpret_cast<void*>(&HookLoadLibraryExW),
                       reinterpret_cast<void**>(&g_originalLoadLibraryExW));
  ok &= InstallOneHook(kernelbase, "LoadLibraryExA", reinterpret_cast<void*>(&HookLoadLibraryExA),
                       reinterpret_cast<void**>(&g_originalLoadLibraryExA));
  ok &= InstallOneHook(kernelbase, "ExitProcess", reinterpret_cast<void*>(&HookExitProcess),
                       reinterpret_cast<void**>(&g_originalExitProcess));
  ok &= InstallOneHook(kernelbase, "TerminateProcess", reinterpret_cast<void*>(&HookTerminateProcess),
                       reinterpret_cast<void**>(&g_originalTerminateProcess));
  ok &= InstallOneHook(ntdll, "LdrLoadDll", reinterpret_cast<void*>(&HookLdrLoadDll),
                       reinterpret_cast<void**>(&g_originalLdrLoadDll));
  ok &= InstallOneHook(ntdll, "LdrGetProcedureAddress", reinterpret_cast<void*>(&HookLdrGetProcedureAddress),
                       reinterpret_cast<void**>(&g_originalLdrGetProcedureAddress));
  ok &= InstallOneHook(kernel32, "GetProcAddress", reinterpret_cast<void*>(&HookGetProcAddress),
                       reinterpret_cast<void**>(&g_originalGetProcAddress));
  return ok;
}

}  // namespace

HRESULT WINAPI HookLoadRegTypeLib(REFGUID guid, WORD major, WORD minor, LCID lcid, ITypeLib** ppTLib) {
  char guid_text[64];
  GuidToAscii(guid, guid_text, ARRAYSIZE(guid_text));
  AppendLog(
      "HookLoadRegTypeLib guid=%s version=%u.%u lcid=%lu",
      guid_text,
      static_cast<unsigned>(major),
      static_cast<unsigned>(minor),
      static_cast<unsigned long>(lcid));

  if (!ppTLib) {
    return E_POINTER;
  }

  if (IsTargetGuid(guid) && SUCCEEDED(EnsurePlaceholderLoaded())) {
    auto* proxy = new (std::nothrow) LoggedTypeLib(g_placeholder);
    if (!proxy) {
      return E_OUTOFMEMORY;
    }
    *ppTLib = proxy;
    AppendLog("HookLoadRegTypeLib returning logged proxy");
    return S_OK;
  }

  if (!g_originalLoadRegTypeLib) {
    AppendLog("HookLoadRegTypeLib original missing");
    return E_FAIL;
  }

  const HRESULT hr = g_originalLoadRegTypeLib(guid, major, minor, lcid, ppTLib);
  AppendLog("HookLoadRegTypeLib fallback hr=0x%08lX", static_cast<unsigned long>(hr));
  return hr;
}

HRESULT WINAPI HookQueryPathOfRegTypeLib(REFGUID guid, USHORT major, USHORT minor, LCID lcid, BSTR* path) {
  char guid_text[64];
  GuidToAscii(guid, guid_text, ARRAYSIZE(guid_text));
  AppendLog(
      "HookQueryPathOfRegTypeLib guid=%s version=%u.%u lcid=%lu",
      guid_text,
      static_cast<unsigned>(major),
      static_cast<unsigned>(minor),
      static_cast<unsigned long>(lcid));

  if (!path) {
    return E_POINTER;
  }

  if (IsTargetGuid(guid)) {
    *path = SysAllocString(kPlaceholderPath);
    AppendLog("HookQueryPathOfRegTypeLib returning placeholder path");
    return *path ? S_OK : E_OUTOFMEMORY;
  }

  if (!g_originalQueryPathOfRegTypeLib) {
    return E_FAIL;
  }

  const HRESULT hr = g_originalQueryPathOfRegTypeLib(guid, major, minor, lcid, path);
  AppendLog("HookQueryPathOfRegTypeLib fallback hr=0x%08lX", static_cast<unsigned long>(hr));
  return hr;
}

HRESULT WINAPI HookLoadTypeLibEx(LPCOLESTR file, REGKIND regkind, ITypeLib** ppTLib) {
  char file_utf8[512];
  if (file) {
    WideCharToMultiByte(CP_UTF8, 0, file, -1, file_utf8, ARRAYSIZE(file_utf8), nullptr, nullptr);
  } else {
    StringCchCopyA(file_utf8, ARRAYSIZE(file_utf8), "<null>");
  }

  AppendLog("HookLoadTypeLibEx file=%s regkind=%d", file_utf8, static_cast<int>(regkind));

  if (!g_originalLoadTypeLibEx) {
    return E_FAIL;
  }

  LPCOLESTR effective_file = file;
  if (file && EndsWithInsensitive(file, L"EcasPlaceholderControl.tlb")) {
    effective_file = kPlaceholderPath;
    AppendLog("HookLoadTypeLibEx redirect managed tlb -> placeholder tlb");
  }

  const HRESULT hr = g_originalLoadTypeLibEx(effective_file, regkind, ppTLib);
  AppendLog("HookLoadTypeLibEx original hr=0x%08lX", static_cast<unsigned long>(hr));

  if (SUCCEEDED(hr) && ppTLib && *ppTLib && IsPlaceholderPath(effective_file)) {
    auto* proxy = new (std::nothrow) LoggedTypeLib(*ppTLib);
    if (!proxy) {
      return E_OUTOFMEMORY;
    }
    (*ppTLib)->Release();
    *ppTLib = proxy;
    AppendLog("HookLoadTypeLibEx wrapped placeholder typelib");
  }

  return hr;
}

HRESULT WINAPI HookCoCreateInstance(REFCLSID rclsid, LPUNKNOWN pUnkOuter, DWORD dwClsContext, REFIID riid, LPVOID* ppv) {
  char clsid_text[64];
  char iid_text[64];
  GuidToAscii(rclsid, clsid_text, ARRAYSIZE(clsid_text));
  GuidToAscii(riid, iid_text, ARRAYSIZE(iid_text));
  AppendLog("HookCoCreateInstance clsid=%s iid=%s ctx=0x%08lX", clsid_text, iid_text, static_cast<unsigned long>(dwClsContext));
  const HRESULT hr = g_originalCoCreateInstance ? g_originalCoCreateInstance(rclsid, pUnkOuter, dwClsContext, riid, ppv) : E_FAIL;
  AppendLog("HookCoCreateInstance hr=0x%08lX", static_cast<unsigned long>(hr));
  return hr;
}

HRESULT WINAPI HookCoGetClassObject(REFCLSID rclsid, DWORD dwClsContext, LPVOID pvReserved, REFIID riid, LPVOID* ppv) {
  char clsid_text[64];
  char iid_text[64];
  GuidToAscii(rclsid, clsid_text, ARRAYSIZE(clsid_text));
  GuidToAscii(riid, iid_text, ARRAYSIZE(iid_text));
  AppendLog("HookCoGetClassObject clsid=%s iid=%s ctx=0x%08lX", clsid_text, iid_text, static_cast<unsigned long>(dwClsContext));
  const HRESULT hr = g_originalCoGetClassObject ? g_originalCoGetClassObject(rclsid, dwClsContext, pvReserved, riid, ppv) : E_FAIL;
  AppendLog("HookCoGetClassObject hr=0x%08lX", static_cast<unsigned long>(hr));
  return hr;
}

HRESULT WINAPI HookCoCreateInstanceEx(REFCLSID clsid,
                                      IUnknown* punkOuter,
                                      DWORD dwClsCtx,
                                      COSERVERINFO* pServerInfo,
                                      DWORD cmq,
                                      MULTI_QI* pResults) {
  char clsid_text[64];
  GuidToAscii(clsid, clsid_text, ARRAYSIZE(clsid_text));
  AppendLog("HookCoCreateInstanceEx clsid=%s ctx=0x%08lX count=%lu", clsid_text, static_cast<unsigned long>(dwClsCtx),
            static_cast<unsigned long>(cmq));
  const HRESULT hr =
      g_originalCoCreateInstanceEx ? g_originalCoCreateInstanceEx(clsid, punkOuter, dwClsCtx, pServerInfo, cmq, pResults) : E_FAIL;
  AppendLog("HookCoCreateInstanceEx hr=0x%08lX", static_cast<unsigned long>(hr));
  return hr;
}

HRESULT WINAPI HookCLSIDFromProgID(LPCOLESTR lpszProgID, LPCLSID lpclsid) {
  char progid_utf8[512];
  WideToUtf8(lpszProgID, progid_utf8, ARRAYSIZE(progid_utf8));
  AppendLog("HookCLSIDFromProgID progid=%s", progid_utf8);
  const HRESULT hr = g_originalCLSIDFromProgID ? g_originalCLSIDFromProgID(lpszProgID, lpclsid) : E_FAIL;
  if (SUCCEEDED(hr) && lpclsid) {
    char clsid_text[64];
    GuidToAscii(*lpclsid, clsid_text, ARRAYSIZE(clsid_text));
    AppendLog("HookCLSIDFromProgID hr=0x%08lX clsid=%s", static_cast<unsigned long>(hr), clsid_text);
  } else {
    AppendLog("HookCLSIDFromProgID hr=0x%08lX", static_cast<unsigned long>(hr));
  }
  return hr;
}

LSTATUS WINAPI HookRegOpenKeyExW(HKEY hKey, LPCWSTR lpSubKey, DWORD ulOptions, REGSAM samDesired, PHKEY phkResult) {
  const bool should_log = ShouldLogRegistryPath(lpSubKey);
  if (should_log) {
    char subkey_utf8[512];
    WideToUtf8(lpSubKey, subkey_utf8, ARRAYSIZE(subkey_utf8));
    AppendLog("HookRegOpenKeyExW root=%s subkey=%s sam=0x%08lX", RegistryRootName(hKey), subkey_utf8,
              static_cast<unsigned long>(samDesired));
  }
  const LSTATUS status = g_originalRegOpenKeyExW ? g_originalRegOpenKeyExW(hKey, lpSubKey, ulOptions, samDesired, phkResult) : ERROR_PROC_NOT_FOUND;
  if (should_log) {
    AppendLog("HookRegOpenKeyExW status=%ld", static_cast<long>(status));
  }
  return status;
}

LSTATUS WINAPI HookRegOpenKeyExA(HKEY hKey, LPCSTR lpSubKey, DWORD ulOptions, REGSAM samDesired, PHKEY phkResult) {
  wchar_t wide[512];
  wide[0] = L'\0';
  if (lpSubKey) {
    MultiByteToWideChar(CP_ACP, 0, lpSubKey, -1, wide, ARRAYSIZE(wide));
  }
  const bool should_log = ShouldLogRegistryPath(lpSubKey ? wide : nullptr);
  if (should_log) {
    AppendLog("HookRegOpenKeyExA root=%s subkey=%s sam=0x%08lX", RegistryRootName(hKey), lpSubKey ? lpSubKey : "<null>",
              static_cast<unsigned long>(samDesired));
  }
  const LSTATUS status = g_originalRegOpenKeyExA ? g_originalRegOpenKeyExA(hKey, lpSubKey, ulOptions, samDesired, phkResult) : ERROR_PROC_NOT_FOUND;
  if (should_log) {
    AppendLog("HookRegOpenKeyExA status=%ld", static_cast<long>(status));
  }
  return status;
}

HMODULE WINAPI HookLoadLibraryW(LPCWSTR file) {
  const wchar_t* redirected_path = nullptr;
  char requested_utf8[512];
  WideToUtf8(file, requested_utf8, ARRAYSIZE(requested_utf8));

  if (ResolveRedirectPath(file, &redirected_path)) {
    char redirected_utf8[512];
    WideToUtf8(redirected_path, redirected_utf8, ARRAYSIZE(redirected_utf8));
    AppendLog("HookLoadLibraryW redirect %s -> %s", requested_utf8, redirected_utf8);
    HMODULE module = g_originalLoadLibraryW ? g_originalLoadLibraryW(redirected_path) : nullptr;
    AppendLog("HookLoadLibraryW redirected result=%p gle=%lu", module, GetLastError());
    UpdateTrackedModule(redirected_path, module);
    return module;
  }

  HMODULE module = g_originalLoadLibraryW ? g_originalLoadLibraryW(file) : nullptr;
  AppendLog("HookLoadLibraryW pass %s result=%p", requested_utf8, module);
  return module;
}

HMODULE WINAPI HookLoadLibraryA(LPCSTR file) {
  wchar_t wide[512];
  wide[0] = L'\0';
  if (file) {
    MultiByteToWideChar(CP_ACP, 0, file, -1, wide, ARRAYSIZE(wide));
  }

  const wchar_t* redirected_path = nullptr;
  if (ResolveRedirectPath(file ? wide : nullptr, &redirected_path)) {
    char redirected_utf8[512];
    WideToUtf8(redirected_path, redirected_utf8, ARRAYSIZE(redirected_utf8));
    AppendLog("HookLoadLibraryA redirect %s -> %s", file ? file : "<null>", redirected_utf8);
    HMODULE module = g_originalLoadLibraryW ? g_originalLoadLibraryW(redirected_path) : nullptr;
    AppendLog("HookLoadLibraryA redirected result=%p gle=%lu", module, GetLastError());
    UpdateTrackedModule(redirected_path, module);
    return module;
  }

  HMODULE module = g_originalLoadLibraryA ? g_originalLoadLibraryA(file) : nullptr;
  AppendLog("HookLoadLibraryA pass %s result=%p", file ? file : "<null>", module);
  return module;
}

HMODULE WINAPI HookLoadLibraryExW(LPCWSTR file, HANDLE file_handle, DWORD flags) {
  const wchar_t* redirected_path = nullptr;
  char requested_utf8[512];
  WideToUtf8(file, requested_utf8, ARRAYSIZE(requested_utf8));

  if (ResolveRedirectPath(file, &redirected_path)) {
    char redirected_utf8[512];
    WideToUtf8(redirected_path, redirected_utf8, ARRAYSIZE(redirected_utf8));
    AppendLog("HookLoadLibraryExW redirect %s -> %s flags=0x%08lX", requested_utf8, redirected_utf8,
              static_cast<unsigned long>(flags));
    HMODULE module = g_originalLoadLibraryExW ? g_originalLoadLibraryExW(redirected_path, file_handle, flags) : nullptr;
    AppendLog("HookLoadLibraryExW redirected result=%p gle=%lu", module, GetLastError());
    UpdateTrackedModule(redirected_path, module);
    return module;
  }

  HMODULE module = g_originalLoadLibraryExW ? g_originalLoadLibraryExW(file, file_handle, flags) : nullptr;
  AppendLog("HookLoadLibraryExW pass %s flags=0x%08lX result=%p", requested_utf8, static_cast<unsigned long>(flags), module);
  return module;
}

HMODULE WINAPI HookLoadLibraryExA(LPCSTR file, HANDLE file_handle, DWORD flags) {
  wchar_t wide[512];
  wide[0] = L'\0';
  if (file) {
    MultiByteToWideChar(CP_ACP, 0, file, -1, wide, ARRAYSIZE(wide));
  }

  const wchar_t* redirected_path = nullptr;
  if (ResolveRedirectPath(file ? wide : nullptr, &redirected_path)) {
    char redirected_utf8[512];
    WideToUtf8(redirected_path, redirected_utf8, ARRAYSIZE(redirected_utf8));
    AppendLog("HookLoadLibraryExA redirect %s -> %s flags=0x%08lX", file ? file : "<null>", redirected_utf8,
              static_cast<unsigned long>(flags));
    HMODULE module = g_originalLoadLibraryExW ? g_originalLoadLibraryExW(redirected_path, file_handle, flags) : nullptr;
    AppendLog("HookLoadLibraryExA redirected result=%p gle=%lu", module, GetLastError());
    UpdateTrackedModule(redirected_path, module);
    return module;
  }

  HMODULE module = g_originalLoadLibraryExA ? g_originalLoadLibraryExA(file, file_handle, flags) : nullptr;
  AppendLog("HookLoadLibraryExA pass %s flags=0x%08lX result=%p", file ? file : "<null>",
            static_cast<unsigned long>(flags), module);
  return module;
}

FARPROC WINAPI HookGetProcAddress(HMODULE module, LPCSTR proc_name) {
  FARPROC result = g_originalGetProcAddress ? g_originalGetProcAddress(module, proc_name) : nullptr;

  if (module == g_vb6arModule || module == g_vbameModule) {
    const char* library_name = module == g_vb6arModule ? "VB6AR" : "VBAME";
    if (IsOrdinalProcName(proc_name)) {
      AppendLog("HookGetProcAddress %s ordinal=%lu result=%p", library_name,
                static_cast<unsigned long>(reinterpret_cast<ULONG_PTR>(proc_name)), result);
    } else {
      AppendLog("HookGetProcAddress %s name=%s result=%p", library_name, proc_name ? proc_name : "<null>", result);
    }
  }

  return result;
}

VOID WINAPI HookExitProcess(UINT exit_code) {
  AppendLog("HookExitProcess exit_code=%u", static_cast<unsigned>(exit_code));
  LogStackTrace("HookExitProcess");
  if (g_originalExitProcess) {
    g_originalExitProcess(exit_code);
  }
}

BOOL WINAPI HookTerminateProcess(HANDLE process, UINT exit_code) {
  AppendLog("HookTerminateProcess process=%p exit_code=%u", process, static_cast<unsigned>(exit_code));
  LogStackTrace("HookTerminateProcess");
  return g_originalTerminateProcess ? g_originalTerminateProcess(process, exit_code) : FALSE;
}

void __declspec(naked) HookVbaHresultCheckStub() {
  __asm {
    mov eax, esp
    push eax
    push offset kVbaHresultCheckName
    call LogVbaRawCall
    jmp dword ptr [g_originalVbaHresultCheck]
  }
}

void __declspec(naked) HookVbaHresultCheckObjStub() {
  __asm {
    mov eax, esp
    push eax
    push offset kVbaHresultCheckObjName
    call LogVbaRawCall
    jmp dword ptr [g_originalVbaHresultCheckObj]
  }
}

void __declspec(naked) HookDllFunctionCallStub() {
  __asm {
    mov eax, esp
    push eax
    push offset kDllFunctionCallName
    call LogVbaRawCall
    jmp dword ptr [g_originalDllFunctionCall]
  }
}

NTSTATUS NTAPI HookLdrLoadDll(PWSTR search_path, PULONG load_flags, PUNICODE_STRING module_name, PHANDLE module_handle) {
  char module_utf8[512];
  UnicodeStringToUtf8(module_name, module_utf8, ARRAYSIZE(module_utf8));
  AppendLog("HookLdrLoadDll module=%s", module_utf8);
  const NTSTATUS status =
      g_originalLdrLoadDll ? g_originalLdrLoadDll(search_path, load_flags, module_name, module_handle) : STATUS_DLL_NOT_FOUND;
  AppendLog("HookLdrLoadDll status=0x%08lX handle=%p", static_cast<unsigned long>(status),
            module_handle ? *module_handle : nullptr);
  return status;
}

NTSTATUS NTAPI HookLdrGetProcedureAddress(PVOID base_address,
                                          PANSI_STRING name,
                                          ULONG ordinal,
                                          PVOID* address) {
  char name_utf8[256];
  AnsiStringToUtf8(name, name_utf8, ARRAYSIZE(name_utf8));
  char module_desc[512];
  DescribeAddress(base_address, module_desc, ARRAYSIZE(module_desc));
  AppendLog("HookLdrGetProcedureAddress module=%s name=%s ordinal=%lu", module_desc, name_utf8,
            static_cast<unsigned long>(ordinal));
  const NTSTATUS status = g_originalLdrGetProcedureAddress
                              ? g_originalLdrGetProcedureAddress(base_address, name, ordinal, address)
                              : static_cast<NTSTATUS>(0xC000007AL);
  AppendLog("HookLdrGetProcedureAddress status=0x%08lX address=%p", static_cast<unsigned long>(status),
            address ? *address : nullptr);
  return status;
}

BOOL APIENTRY DllMain(HMODULE module, DWORD reason, LPVOID reserved) {
  UNREFERENCED_PARAMETER(module);
  UNREFERENCED_PARAMETER(reserved);

  if (reason == DLL_PROCESS_ATTACH) {
    DisableThreadLibraryCalls(module);
    InitializeCriticalSection(&g_logLock);
    g_logReady.store(true);

    wchar_t exe_path[MAX_PATH];
    GetModuleFileNameW(nullptr, exe_path, ARRAYSIZE(exe_path));
    char exe_utf8[512];
    WideCharToMultiByte(CP_UTF8, 0, exe_path, -1, exe_utf8, ARRAYSIZE(exe_utf8), nullptr, nullptr);
    AppendLog("hook dll loaded for %s", exe_utf8);

    if (ShouldHookCurrentProcess()) {
      AppendLog("installing hook in DllMain");
      InstallInlineHook();
    } else {
      AppendLog("process filtered out");
    }
  } else if (reason == DLL_PROCESS_DETACH) {
    if (g_placeholder) {
      g_placeholder->Release();
      g_placeholder = nullptr;
    }
    if (g_logReady.load()) {
      AppendLog("hook dll unloading");
    }
    DeleteCriticalSection(&g_logLock);
  }

  return TRUE;
}
