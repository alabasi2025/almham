using System;
using System.ComponentModel;
using System.Drawing;
using System.Runtime.InteropServices;
using System.Reflection;
using System.Windows.Forms;
using Microsoft.Win32;

[assembly: ComVisible(true)]
[assembly: Guid("A7AC8459-490C-40B1-B475-3A380430718B")]
[assembly: AssemblyVersion("1.0.0.0")]
[assembly: AssemblyFileVersion("1.0.0.0")]

[ComVisible(true)]
[Guid("9F1A8D32-1D28-48B6-8A80-A7E05EE6DD44")]
[InterfaceType(ComInterfaceType.InterfaceIsIDispatch)]
public interface IEcasRequestedDispatch
{
    [DispId(1)]
    void Placeholder();
}

[ComVisible(true)]
[Guid("74086D3F-A3AA-4370-838E-DA3688F5E4F6")]
[InterfaceType(ComInterfaceType.InterfaceIsIDispatch)]
public interface IEcasRequestedEvents
{
    [DispId(1)]
    void PlaceholderEvent();
}

public delegate void PlaceholderEventHandler();

[ComVisible(true)]
[ProgId("EcasPlaceholder.EcasRequestedClass")]
[Guid("4BC3367A-4FA5-4FC1-943A-F0ECDA7A5677")]
[ClassInterface(ClassInterfaceType.None)]
[ComDefaultInterface(typeof(IEcasRequestedDispatch))]
[ComSourceInterfaces(typeof(IEcasRequestedEvents))]
public class EcasPlaceholderControl : UserControl, IEcasRequestedDispatch
{
    private readonly Label _caption;

    public EcasPlaceholderControl()
    {
        BackColor = Color.Transparent;
        Size = new Size(32, 32);

        _caption = new Label
        {
            Dock = DockStyle.Fill,
            Text = string.Empty,
            BackColor = Color.Transparent
        };

        Controls.Add(_caption);
    }

    public event PlaceholderEventHandler PlaceholderEvent;

    public void Placeholder()
    {
        if (PlaceholderEvent != null)
        {
            PlaceholderEvent();
        }
    }

    [ComRegisterFunction]
    public static void RegisterClass(Type type)
    {
        string clsid = @"CLSID\{" + type.GUID.ToString().ToUpperInvariant() + "}";
        using (RegistryKey root = Registry.CurrentUser.CreateSubKey(@"Software\Classes"))
        {
            using (RegistryKey clsidKey = root.CreateSubKey(clsid))
            {
                if (clsidKey == null)
                {
                    return;
                }

                clsidKey.SetValue(null, "ECAS Placeholder ActiveX Control");
                clsidKey.CreateSubKey("Control");
                clsidKey.CreateSubKey("Insertable");
                using (RegistryKey miscStatus = clsidKey.CreateSubKey(@"MiscStatus\1"))
                using (RegistryKey version = clsidKey.CreateSubKey("Version"))
                using (RegistryKey toolbox = clsidKey.CreateSubKey("ToolboxBitmap32"))
                using (RegistryKey typeLib = clsidKey.CreateSubKey("TypeLib"))
                using (RegistryKey progId = clsidKey.CreateSubKey("ProgID"))
                using (RegistryKey viprogId = clsidKey.CreateSubKey("VersionIndependentProgID"))
                {
                    if (miscStatus != null) miscStatus.SetValue(null, "131457");
                    if (version != null) version.SetValue(null, "1.0");
                    if (toolbox != null) toolbox.SetValue(null, type.Assembly.Location + ", 0");
                    if (typeLib != null) typeLib.SetValue(null, "{A7AC8459-490C-40B1-B475-3A380430718B}");
                    if (progId != null) progId.SetValue(null, "EcasPlaceholder.EcasRequestedClass.1");
                    if (viprogId != null) viprogId.SetValue(null, "EcasPlaceholder.EcasRequestedClass");
                }
            }

            using (RegistryKey viProg = root.CreateSubKey(@"EcasPlaceholder.EcasRequestedClass"))
            using (RegistryKey viClsid = root.CreateSubKey(@"EcasPlaceholder.EcasRequestedClass\CLSID"))
            using (RegistryKey viCurVer = root.CreateSubKey(@"EcasPlaceholder.EcasRequestedClass\CurVer"))
            using (RegistryKey prog = root.CreateSubKey(@"EcasPlaceholder.EcasRequestedClass.1"))
            using (RegistryKey progClsid = root.CreateSubKey(@"EcasPlaceholder.EcasRequestedClass.1\CLSID"))
            {
                if (viProg != null) viProg.SetValue(null, "ECAS Placeholder ActiveX Control");
                if (viClsid != null) viClsid.SetValue(null, "{4BC3367A-4FA5-4FC1-943A-F0ECDA7A5677}");
                if (viCurVer != null) viCurVer.SetValue(null, "EcasPlaceholder.EcasRequestedClass.1");
                if (prog != null) prog.SetValue(null, "ECAS Placeholder ActiveX Control");
                if (progClsid != null) progClsid.SetValue(null, "{4BC3367A-4FA5-4FC1-943A-F0ECDA7A5677}");
            }
        }
    }

    [ComUnregisterFunction]
    public static void UnregisterClass(Type type)
    {
        using (RegistryKey root = Registry.CurrentUser.OpenSubKey(@"Software\Classes", true))
        {
            if (root != null)
            {
                root.DeleteSubKeyTree(@"CLSID\{" + type.GUID.ToString().ToUpperInvariant() + "}", false);
                root.DeleteSubKeyTree(@"EcasPlaceholder.EcasRequestedClass", false);
                root.DeleteSubKeyTree(@"EcasPlaceholder.EcasRequestedClass.1", false);
            }
        }
    }
}
