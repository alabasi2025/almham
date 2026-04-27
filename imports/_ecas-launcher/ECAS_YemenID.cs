using System;
using System.Runtime.InteropServices;
using System.Reflection;

[assembly: ComVisible(true)]
[assembly: Guid("25569FAB-B973-4CED-AF62-47F1528BBED6")]
[assembly: AssemblyVersion("1.0.0.0")]
[assembly: AssemblyFileVersion("1.0.0.0")]

namespace ECAS_YemenID
{
    [ComVisible(true)]
    [Guid("62A3B932-7F74-49D2-AF9E-5A1B1B695001")]
    [InterfaceType(ComInterfaceType.InterfaceIsIDispatch)]
    public interface IECASYemenIdStub
    {
        [DispId(1)]
        string Ping();
    }

    [ComVisible(true)]
    [Guid("7B83D419-72C6-4A1E-9C66-BD356B554001")]
    [ProgId("ECAS_YemenID.Stub")]
    [ClassInterface(ClassInterfaceType.None)]
    [ComDefaultInterface(typeof(IECASYemenIdStub))]
    public class Stub : IECASYemenIdStub
    {
        public string Ping()
        {
            return "ECAS_YemenID";
        }
    }
}
