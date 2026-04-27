using EcasLegacyBilling.Core;
using EcasLegacyBilling.Infrastructure;

namespace EcasLegacyBilling.Desktop;

public sealed class MainForm : Form
{
    private readonly EcasSqlGateway _gateway = new();
    private readonly CancellationTokenSource _formClosed = new();

    private readonly TextBox _serverText = new();
    private readonly TextBox _userText = new();
    private readonly TextBox _passwordText = new();
    private readonly CheckBox _trustCertificateCheck = new();
    private readonly CheckBox _encryptCheck = new();
    private readonly ComboBox _databaseCombo = new();
    private readonly Button _connectButton = new();
    private readonly Button _loadButton = new();
    private readonly Label _statusLabel = new();

    private readonly Label _customersSummary = new();
    private readonly Label _activeCustomersSummary = new();
    private readonly Label _billsSummary = new();
    private readonly Label _paymentsSummary = new();
    private readonly Label _balanceSummary = new();
    private readonly Label _lastDatesSummary = new();

    private readonly TreeView _menuTree = new();
    private readonly DataGridView _usersGrid = CreateGrid();
    private readonly DataGridView _customersGrid = CreateGrid();
    private readonly DataGridView _billsGrid = CreateGrid();
    private readonly DataGridView _paymentsGrid = CreateGrid();

    public MainForm()
    {
        Text = "نظام الفوترة القديم ECAS - تطبيق سطح المكتب";
        Width = 1500;
        Height = 900;
        StartPosition = FormStartPosition.CenterScreen;
        RightToLeft = RightToLeft.Yes;
        RightToLeftLayout = true;
        Font = new Font("Segoe UI", 10F);

        BuildLayout();
        SetDefaults();

        _connectButton.Click += async (_, _) => await LoadDatabasesAsync();
        _loadButton.Click += async (_, _) => await LoadWorkspaceAsync();
        FormClosed += (_, _) => _formClosed.Cancel();
    }

    private void BuildLayout()
    {
        var root = new TableLayoutPanel
        {
            Dock = DockStyle.Fill,
            RowCount = 4,
            ColumnCount = 1,
            Padding = new Padding(12),
        };
        root.RowStyles.Add(new RowStyle(SizeType.Absolute, 92));
        root.RowStyles.Add(new RowStyle(SizeType.Absolute, 82));
        root.RowStyles.Add(new RowStyle(SizeType.Percent, 100));
        root.RowStyles.Add(new RowStyle(SizeType.Absolute, 34));
        Controls.Add(root);

        root.Controls.Add(BuildConnectionPanel(), 0, 0);
        root.Controls.Add(BuildSummaryPanel(), 0, 1);
        root.Controls.Add(BuildMainWorkspace(), 0, 2);

        _statusLabel.Dock = DockStyle.Fill;
        _statusLabel.TextAlign = ContentAlignment.MiddleRight;
        _statusLabel.ForeColor = Color.FromArgb(70, 70, 70);
        root.Controls.Add(_statusLabel, 0, 3);
    }

    private Control BuildConnectionPanel()
    {
        var box = new GroupBox
        {
            Dock = DockStyle.Fill,
            Text = "اتصال SQL Server القديم",
        };

        var layout = new TableLayoutPanel
        {
            Dock = DockStyle.Fill,
            ColumnCount = 10,
            RowCount = 2,
            Padding = new Padding(8),
        };

        for (var i = 0; i < 10; i++)
        {
            layout.ColumnStyles.Add(new ColumnStyle(SizeType.Percent, 10));
        }

        AddField(layout, "السيرفر", _serverText, 0, 0, 2);
        AddField(layout, "المستخدم", _userText, 2, 0, 2);
        AddField(layout, "كلمة المرور", _passwordText, 4, 0, 2);

        _trustCertificateCheck.Text = "Trust Cert";
        _trustCertificateCheck.Dock = DockStyle.Fill;
        layout.Controls.Add(_trustCertificateCheck, 6, 0);

        _encryptCheck.Text = "Encrypt";
        _encryptCheck.Dock = DockStyle.Fill;
        layout.Controls.Add(_encryptCheck, 7, 0);

        _connectButton.Text = "جلب قواعد ECAS";
        _connectButton.Dock = DockStyle.Fill;
        layout.Controls.Add(_connectButton, 8, 0);
        layout.SetColumnSpan(_connectButton, 2);

        AddLabel(layout, "قاعدة المحطة", 0, 1);
        _databaseCombo.Dock = DockStyle.Fill;
        _databaseCombo.DropDownStyle = ComboBoxStyle.DropDownList;
        layout.Controls.Add(_databaseCombo, 1, 1);
        layout.SetColumnSpan(_databaseCombo, 3);

        _loadButton.Text = "فتح قاعدة الفوترة";
        _loadButton.Dock = DockStyle.Fill;
        layout.Controls.Add(_loadButton, 4, 1);
        layout.SetColumnSpan(_loadButton, 2);

        var hint = new Label
        {
            Dock = DockStyle.Fill,
            TextAlign = ContentAlignment.MiddleRight,
            ForeColor = Color.FromArgb(95, 95, 95),
            Text = "المصدر الوحيد هنا هو قواعد ECAS القديمة: Customer / BillAndRaedData / PaymentData / UserData / FormData",
        };
        layout.Controls.Add(hint, 6, 1);
        layout.SetColumnSpan(hint, 4);

        box.Controls.Add(layout);
        return box;
    }

    private Control BuildSummaryPanel()
    {
        var layout = new TableLayoutPanel
        {
            Dock = DockStyle.Fill,
            ColumnCount = 6,
            RowCount = 1,
        };

        for (var i = 0; i < 6; i++)
        {
            layout.ColumnStyles.Add(new ColumnStyle(SizeType.Percent, 16.66F));
        }

        AddSummaryCard(layout, _customersSummary, "المشتركون", 0);
        AddSummaryCard(layout, _activeCustomersSummary, "النشطون", 1);
        AddSummaryCard(layout, _billsSummary, "الفواتير", 2);
        AddSummaryCard(layout, _paymentsSummary, "التسديدات", 3);
        AddSummaryCard(layout, _balanceSummary, "الرصيد", 4);
        AddSummaryCard(layout, _lastDatesSummary, "آخر حركة", 5);

        return layout;
    }

    private Control BuildMainWorkspace()
    {
        var split = new SplitContainer
        {
            Dock = DockStyle.Fill,
            SplitterDistance = 360,
            RightToLeft = RightToLeft.Yes,
        };

        var menuBox = new GroupBox
        {
            Dock = DockStyle.Fill,
            Text = "قوائم ECAS من FormData",
        };
        _menuTree.Dock = DockStyle.Fill;
        menuBox.Controls.Add(_menuTree);
        split.Panel1.Controls.Add(menuBox);

        var tabs = new TabControl
        {
            Dock = DockStyle.Fill,
        };

        AddTab(tabs, "المستخدمون", _usersGrid);
        AddTab(tabs, "المشتركون", _customersGrid);
        AddTab(tabs, "الفواتير والقراءات", _billsGrid);
        AddTab(tabs, "التسديدات", _paymentsGrid);

        split.Panel2.Controls.Add(tabs);
        return split;
    }

    private void SetDefaults()
    {
        _serverText.Text = @".\ECASDEV";
        _userText.Text = "sa";
        _passwordText.UseSystemPasswordChar = true;
        _passwordText.Text = Environment.GetEnvironmentVariable("ECAS_SQL_PASSWORD") ?? string.Empty;
        _trustCertificateCheck.Checked = true;
        _encryptCheck.Checked = true;
        _statusLabel.Text = "جاهز. أدخل كلمة مرور SQL Server أو ضعها في ECAS_SQL_PASSWORD ثم اضغط جلب قواعد ECAS.";
        ClearSummary();
    }

    private async Task LoadDatabasesAsync()
    {
        await RunBusyAsync(async token =>
        {
            _statusLabel.Text = "جارٍ الاتصال بـ SQL Server وقراءة قواعد ECAS...";
            var databases = await _gateway.GetDatabasesAsync(BuildProfile(), token);

            _databaseCombo.DataSource = databases.ToList();
            _databaseCombo.DisplayMember = nameof(LegacyDatabaseInfo.Name);
            _databaseCombo.ValueMember = nameof(LegacyDatabaseInfo.Name);

            if (databases.Count > 0)
            {
                var preferred = databases.FirstOrDefault(db => db.Name.Equals("Ecas2673", StringComparison.OrdinalIgnoreCase));
                _databaseCombo.SelectedItem = preferred ?? databases[^1];
            }

            _statusLabel.Text = $"تم العثور على {databases.Count} قاعدة ECAS قديمة.";
        });
    }

    private async Task LoadWorkspaceAsync()
    {
        if (_databaseCombo.SelectedItem is not LegacyDatabaseInfo database)
        {
            MessageBox.Show("اختر قاعدة ECAS أولاً.", "تنبيه", MessageBoxButtons.OK, MessageBoxIcon.Information);
            return;
        }

        await RunBusyAsync(async token =>
        {
            _statusLabel.Text = $"جارٍ تحميل بيانات {database.Name} من نظام الفوترة القديم...";
            var workspace = await _gateway.LoadWorkspaceAsync(BuildProfile(), database.Name, 300, token);

            RenderSummary(workspace.Summary);
            RenderMenu(workspace.MenuEntries);
            _usersGrid.DataSource = workspace.Users.ToList();
            _customersGrid.DataSource = workspace.Customers.ToList();
            _billsGrid.DataSource = workspace.Bills.ToList();
            _paymentsGrid.DataSource = workspace.Payments.ToList();

            _statusLabel.Text = $"تم فتح {database.Name}. كل البيانات المعروضة مصدرها ECAS القديم فقط.";
        });
    }

    private async Task RunBusyAsync(Func<CancellationToken, Task> action)
    {
        ToggleBusy(true);
        try
        {
            await action(_formClosed.Token);
        }
        catch (Exception ex)
        {
            _statusLabel.Text = "فشل تنفيذ العملية.";
            MessageBox.Show(ex.Message, "خطأ", MessageBoxButtons.OK, MessageBoxIcon.Error);
        }
        finally
        {
            ToggleBusy(false);
        }
    }

    private ConnectionProfile BuildProfile()
    {
        return new ConnectionProfile(
            _serverText.Text.Trim(),
            _userText.Text.Trim(),
            _passwordText.Text,
            _trustCertificateCheck.Checked,
            _encryptCheck.Checked);
    }

    private void RenderSummary(DashboardSummary summary)
    {
        _customersSummary.Text = summary.CustomerCount.ToString("N0");
        _activeCustomersSummary.Text = summary.ActiveCustomerCount.ToString("N0");
        _billsSummary.Text = summary.BillCount.ToString("N0");
        _paymentsSummary.Text = summary.PaymentCount.ToString("N0");
        _balanceSummary.Text = $"{summary.TotalCurrentBalance:N0} ريال";
        _lastDatesSummary.Text =
            $"فوترة: {FormatDate(summary.LastBillingDate)}\nتسديد: {FormatDate(summary.LastPaymentDate)}";
    }

    private void RenderMenu(IReadOnlyList<LegacyMenuEntry> entries)
    {
        _menuTree.BeginUpdate();
        _menuTree.Nodes.Clear();

        foreach (var group in entries.GroupBy(entry => string.IsNullOrWhiteSpace(entry.MenuKey) || entry.MenuKey == "#"
                     ? "عمليات مباشرة"
                     : entry.MenuKey).OrderBy(group => group.Key))
        {
            var menuNode = new TreeNode(group.Key);
            foreach (var entry in group.OrderBy(item => item.FormId))
            {
                menuNode.Nodes.Add(new TreeNode($"{entry.FormId} - {entry.FormName}"));
            }

            _menuTree.Nodes.Add(menuNode);
        }

        if (_menuTree.Nodes.Count > 0)
        {
            _menuTree.Nodes[0].Expand();
        }

        _menuTree.EndUpdate();
    }

    private void ClearSummary()
    {
        _customersSummary.Text = "0";
        _activeCustomersSummary.Text = "0";
        _billsSummary.Text = "0";
        _paymentsSummary.Text = "0";
        _balanceSummary.Text = "0 ريال";
        _lastDatesSummary.Text = "-";
    }

    private void ToggleBusy(bool busy)
    {
        _connectButton.Enabled = !busy;
        _loadButton.Enabled = !busy;
        Cursor = busy ? Cursors.WaitCursor : Cursors.Default;
    }

    private static void AddField(TableLayoutPanel layout, string label, Control field, int column, int row, int span)
    {
        AddLabel(layout, label, column, row);
        field.Dock = DockStyle.Fill;
        layout.Controls.Add(field, column + 1, row);
        layout.SetColumnSpan(field, span - 1);
    }

    private static void AddLabel(TableLayoutPanel layout, string text, int column, int row)
    {
        layout.Controls.Add(new Label
        {
            Text = text,
            Dock = DockStyle.Fill,
            TextAlign = ContentAlignment.MiddleRight,
        }, column, row);
    }

    private static void AddSummaryCard(TableLayoutPanel layout, Label valueLabel, string title, int column)
    {
        var panel = new Panel
        {
            Dock = DockStyle.Fill,
            BackColor = Color.FromArgb(245, 248, 250),
            BorderStyle = BorderStyle.FixedSingle,
            Margin = new Padding(4),
        };

        var titleLabel = new Label
        {
            Dock = DockStyle.Top,
            Height = 24,
            Text = title,
            TextAlign = ContentAlignment.MiddleCenter,
            ForeColor = Color.FromArgb(90, 90, 90),
        };

        valueLabel.Dock = DockStyle.Fill;
        valueLabel.TextAlign = ContentAlignment.MiddleCenter;
        valueLabel.Font = new Font("Segoe UI", 12F, FontStyle.Bold);

        panel.Controls.Add(valueLabel);
        panel.Controls.Add(titleLabel);
        layout.Controls.Add(panel, column, 0);
    }

    private static void AddTab(TabControl tabs, string title, DataGridView grid)
    {
        var page = new TabPage(title)
        {
            RightToLeft = RightToLeft.Yes,
        };
        page.Controls.Add(grid);
        tabs.TabPages.Add(page);
    }

    private static DataGridView CreateGrid()
    {
        return new DataGridView
        {
            Dock = DockStyle.Fill,
            ReadOnly = true,
            AllowUserToAddRows = false,
            AllowUserToDeleteRows = false,
            AutoGenerateColumns = true,
            AutoSizeColumnsMode = DataGridViewAutoSizeColumnsMode.DisplayedCells,
            SelectionMode = DataGridViewSelectionMode.FullRowSelect,
            BackgroundColor = Color.White,
        };
    }

    private static string FormatDate(DateTime? value)
    {
        return value?.ToString("yyyy/MM/dd") ?? "-";
    }
}
