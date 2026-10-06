// Windows/.NET Framework diagnostic only. No mutation or injection into WeType.
// The edit box is a test host, NOT a replacement candidate window.
using System;
using System.Collections.Generic;
using System.Diagnostics;
using System.Drawing;
using System.IO;
using System.Runtime.InteropServices;
using System.Security.Cryptography;
using System.Text;
using System.Threading;
using System.Web.Script.Serialization;
using System.Windows.Automation;
using System.Windows.Forms;

namespace WeTypeNativeProbe
{
    public static class Entry
    {
        public static void Run(string outputDirectory)
        {
            if (Environment.OSVersion.Platform != PlatformID.Win32NT)
                throw new PlatformNotSupportedException("Windows is required.");
            Directory.CreateDirectory(outputDirectory);
            Application.EnableVisualStyles();
            Application.SetCompatibleTextRenderingDefault(false);
            using (ProbeForm form = new ProbeForm(outputDirectory)) Application.Run(form);
        }

        internal static Dictionary<string, object> Obj(params object[] values)
        {
            Dictionary<string, object> d = new Dictionary<string, object>();
            for (int i = 0; i < values.Length; i += 2) d[(string)values[i]] = values[i + 1];
            return d;
        }

        internal static string ErrorTag(Exception e)
        { return e.GetType().Name + ":0x" + e.HResult.ToString("X8"); }

        internal static void WriteJson(string path, object value)
        {
            JavaScriptSerializer serializer = new JavaScriptSerializer();
            serializer.MaxJsonLength = 16 * 1024 * 1024;
            serializer.RecursionLimit = 100;
            string temp = path + ".tmp";
            File.WriteAllText(temp, serializer.Serialize(value), new UTF8Encoding(false));
            if (File.Exists(path)) File.Delete(path);
            File.Move(temp, path);
        }
    }

    internal static class Inventory
    {
        internal static bool IsTarget(string name)
        {
            string s = name.ToLowerInvariant();
            // Hints are explicitly not a verified target allowlist for a future patch.
            return s == "wetype" || s.StartsWith("wetype_") || s == "wechatinput"
                || s == "wechatinputserver" || s == "wechatinputui"
                || s == "wechatinputcore" || s == "wxkeyboard";
        }

        internal static HashSet<int> Pids()
        {
            HashSet<int> ids = new HashSet<int>();
            foreach (Process p in Process.GetProcesses())
            {
                using (p) { try { if (IsTarget(p.ProcessName)) ids.Add(p.Id); } catch { } }
            }
            return ids;
        }

        internal static List<Dictionary<string, object>> Read()
        {
            List<Dictionary<string, object>> result = new List<Dictionary<string, object>>();
            foreach (Process p in Process.GetProcesses())
            {
                using (p)
                {
                    try
                    {
                        if (!IsTarget(p.ProcessName)) continue;
                        Dictionary<string, object> item = Entry.Obj("pid", p.Id,
                            "process_name", p.ProcessName, "module_enumeration", "not_attempted");
                        result.Add(item);
                        try
                        {
                            string path = p.MainModule.FileName;
                            FileVersionInfo vi = FileVersionInfo.GetVersionInfo(path);
                            item["executable_name"] = Path.GetFileName(path);
                            item["file_version"] = vi.FileVersion;
                            item["product_version"] = vi.ProductVersion;
                            item["company"] = vi.CompanyName;
                            FileInfo fi = new FileInfo(path);
                            item["executable_bytes"] = fi.Length;
                            if (fi.Length <= 256L * 1024L * 1024L)
                            {
                                using (FileStream f = new FileStream(path, FileMode.Open, FileAccess.Read,
                                    FileShare.ReadWrite | FileShare.Delete))
                                using (SHA256 hash = SHA256.Create())
                                    item["executable_sha256"] = BitConverter.ToString(hash.ComputeHash(f)).Replace("-", "").ToLowerInvariant();
                            }
                            else item["hash_status"] = "skipped_size_over_256MiB";
                        }
                        catch (Exception e) { item["executable_error"] = Entry.ErrorTag(e); }
                        try
                        {
                            List<Dictionary<string, object>> modules = new List<Dictionary<string, object>>();
                            foreach (ProcessModule module in p.Modules)
                            {
                                if (modules.Count >= 512) break;
                                modules.Add(Entry.Obj("name", module.ModuleName,
                                    "file_version", module.FileVersionInfo.FileVersion));
                            }
                            item["modules"] = modules;
                            item["module_enumeration"] = "ok";
                        }
                        catch (Exception e) { item["module_enumeration"] = Entry.ErrorTag(e); }
                    }
                    catch { /* Processes may exit while being enumerated. */ }
                }
            }
            return result;
        }
    }

    internal sealed class WindowInfo
    {
        public IntPtr Handle;
        public uint Pid;
        public bool Visible;
        public bool TopLevel;
        public int Width;
        public int Height;
        public Dictionary<string, object> Data;
    }

    internal static class Native
    {
        internal delegate bool EnumProc(IntPtr hwnd, IntPtr value);
        [StructLayout(LayoutKind.Sequential)] internal struct Rect
        { public int Left, Top, Right, Bottom; }
        [DllImport("user32.dll")] [return: MarshalAs(UnmanagedType.Bool)]
        internal static extern bool EnumWindows(EnumProc callback, IntPtr value);
        [DllImport("user32.dll")] [return: MarshalAs(UnmanagedType.Bool)]
        internal static extern bool EnumChildWindows(IntPtr parent, EnumProc callback, IntPtr value);
        [DllImport("user32.dll")] internal static extern uint GetWindowThreadProcessId(IntPtr hwnd, out uint pid);
        [DllImport("user32.dll", CharSet = CharSet.Unicode)] internal static extern int GetClassName(IntPtr hwnd, StringBuilder name, int count);
        [DllImport("user32.dll")] [return: MarshalAs(UnmanagedType.Bool)] internal static extern bool GetWindowRect(IntPtr hwnd, out Rect rect);
        [DllImport("user32.dll")] [return: MarshalAs(UnmanagedType.Bool)] internal static extern bool IsWindowVisible(IntPtr hwnd);
        [DllImport("user32.dll")] internal static extern IntPtr GetForegroundWindow();
        [DllImport("user32.dll")] internal static extern IntPtr GetParent(IntPtr hwnd);
        [DllImport("user32.dll")] internal static extern uint GetDpiForWindow(IntPtr hwnd);

        internal static string Hex(IntPtr pointer) { return "0x" + pointer.ToInt64().ToString("X"); }

        internal static List<WindowInfo> Windows(HashSet<int> ids)
        {
            List<WindowInfo> result = new List<WindowInfo>();
            HashSet<long> seen = new HashSet<long>();
            EnumProc top = delegate(IntPtr hwnd, IntPtr unused)
            {
                uint pid;
                GetWindowThreadProcessId(hwnd, out pid);
                if (!ids.Contains((int)pid)) return true;
                Add(hwnd, true, ids, seen, result);
                EnumProc child = delegate(IntPtr h, IntPtr x)
                { Add(h, false, ids, seen, result); return result.Count < 256; };
                EnumChildWindows(hwnd, child, IntPtr.Zero);
                GC.KeepAlive(child);
                return result.Count < 256;
            };
            EnumWindows(top, IntPtr.Zero);
            GC.KeepAlive(top);
            return result;
        }

        private static void Add(IntPtr hwnd, bool top, HashSet<int> ids, HashSet<long> seen, List<WindowInfo> result)
        {
            uint pid;
            uint thread = GetWindowThreadProcessId(hwnd, out pid);
            if (!ids.Contains((int)pid) || !seen.Add(hwnd.ToInt64()) || result.Count >= 256) return;
            Rect r;
            if (!GetWindowRect(hwnd, out r)) return;
            StringBuilder cls = new StringBuilder(512);
            GetClassName(hwnd, cls, cls.Capacity);
            uint dpi = 0;
            try { dpi = GetDpiForWindow(hwnd); } catch (EntryPointNotFoundException) { }
            WindowInfo wi = new WindowInfo();
            wi.Handle = hwnd; wi.Pid = pid; wi.Visible = IsWindowVisible(hwnd); wi.TopLevel = top;
            wi.Width = r.Right - r.Left; wi.Height = r.Bottom - r.Top;
            wi.Data = Entry.Obj("hwnd", Hex(hwnd), "pid", pid, "thread_id", thread,
                "parent_hwnd", Hex(GetParent(hwnd)), "top_level", top,
                "class_name", cls.ToString(), "visible", wi.Visible, "dpi", dpi,
                "rectangle", new int[] { r.Left, r.Top, r.Right, r.Bottom });
            result.Add(wi);
        }
    }


    // Standard Windows IMM read only, scoped to this controlled editor.
    // A zero result means "not exposed here", not "WeType has no candidates".
    internal static class StandardImeCandidates
    {
        [DllImport("user32.dll")] static extern IntPtr GetKeyboardLayout(uint thread);
        [DllImport("imm32.dll", CharSet=CharSet.Unicode)] static extern uint ImmGetDescriptionW(IntPtr layout, StringBuilder description, uint capacity);
        [DllImport("imm32.dll")] static extern IntPtr ImmGetContext(IntPtr hwnd);
        [DllImport("imm32.dll")] static extern bool ImmReleaseContext(IntPtr hwnd, IntPtr imc);
        [DllImport("imm32.dll", CharSet=CharSet.Unicode)] static extern uint ImmGetCandidateListW(IntPtr imc, uint index, IntPtr list, uint bytes);
        internal static Dictionary<string, object> Read(IntPtr editor)
        {
            IntPtr imc = ImmGetContext(editor);
            if (imc == IntPtr.Zero) return Entry.Obj("status", "no_input_context");
            IntPtr buffer = IntPtr.Zero;
            try
            {
                IntPtr layout = GetKeyboardLayout(0);
                StringBuilder provider = new StringBuilder(256);
                ImmGetDescriptionW(layout, provider, 256);
                uint bytes = ImmGetCandidateListW(imc, 0, IntPtr.Zero, 0);
                if (bytes == 0) return Entry.Obj("status", "not_exposed_here");
                if (bytes < 24 || bytes > 65536) return Entry.Obj("status", "size_rejected");
                buffer = Marshal.AllocHGlobal((int)bytes);
                uint copied = ImmGetCandidateListW(imc, 0, buffer, bytes);
                if (copied < 24 || copied > bytes) return Entry.Obj("status", "copy_rejected");
                uint declared = unchecked((uint)Marshal.ReadInt32(buffer, 0));
                uint count = unchecked((uint)Marshal.ReadInt32(buffer, 8));
                uint selection = unchecked((uint)Marshal.ReadInt32(buffer, 12));
                uint pageStart = unchecked((uint)Marshal.ReadInt32(buffer, 16));
                uint pageSize = unchecked((uint)Marshal.ReadInt32(buffer, 20));
                if (declared > copied || declared < 24 || count > 2048 || 24UL + 4UL * count > declared)
                    return Entry.Obj("status", "header_rejected");
                if ((count > 0 && selection >= count) || pageStart > count || pageSize > count - pageStart)
                    return Entry.Obj("status", "indices_rejected");
                List<Dictionary<string, object>> hits = new List<Dictionary<string, object>>();
                for (uint i=0; i<count; i++)
                {
                    uint offset = unchecked((uint)Marshal.ReadInt32(buffer, 24 + (int)i*4));
                    if (offset < 24UL + 4UL*count || offset >= declared || (offset & 1) != 0)
                        return Entry.Obj("status", "offset_rejected");
                    StringBuilder word = new StringBuilder(); bool terminated=false;
                    for (uint pos=offset; pos+1<declared; pos+=2)
                    {
                        char ch = (char)Marshal.ReadInt16(buffer, (int)pos);
                        if (ch == '\0') { terminated=true; break; }
                        if (word.Length >= 512) return Entry.Obj("status", "string_rejected");
                        word.Append(ch);
                    }
                    if (!terminated) return Entry.Obj("status", "termination_rejected");
                    string actual = word.ToString();
                    // Only these fictitious demonstration words may leave memory.
                    if (actual == "开发" || actual == "学习" || actual == "词典")
                        hits.Add(Entry.Obj("native_index", i, "exact_fixed_word", actual));
                }
                return Entry.Obj("status", "observed", "api", "ImmGetCandidateListW",
                    "provider_verified_as_wetype", false, "keyboard_layout", Native.Hex(layout),
                    "imm_provider_description", provider.ToString(),
                    "count", count, "selection", selection, "page_start", pageStart,
                    "page_size", pageSize, "exact_fixed_word_hits", hits,
                    "limitation", "Standard IMM metadata only; no original-window layout or draw extension proven.");
            }
            catch (Exception e) { return Entry.Obj("status", "error", "error", Entry.ErrorTag(e)); }
            finally { if (buffer != IntPtr.Zero) Marshal.FreeHGlobal(buffer); ImmReleaseContext(editor, imc); }
        }
    }

    internal static class Accessibility
    {
        private static readonly string[] Samples = new string[]
        { "开发", "学习", "词典" };

        internal static Dictionary<string, object> Read(List<WindowInfo> windows, HashSet<int> allowedPids, Func<bool> stillScoped)
        {
            Stopwatch watch = Stopwatch.StartNew();
            List<Dictionary<string, object>> nodes = new List<Dictionary<string, object>>();
            List<string> errors = new List<string>();
            int roots = 0;
            foreach (WindowInfo w in windows)
            {
                if (!stillScoped()) break;
                if (!w.Visible || !w.TopLevel || w.Width <= 0 || w.Height <= 0) continue;
                if (roots >= 8 || nodes.Count >= 160 || watch.ElapsedMilliseconds > 1800) break;
                roots++;
                try { Walk(AutomationElement.FromHandle(w.Handle), 0, w.Handle, allowedPids, nodes, errors, watch, stillScoped); }
                catch (Exception e) { errors.Add(Entry.ErrorTag(e)); }
            }
            return Entry.Obj("elapsed_ms", watch.ElapsedMilliseconds, "root_count", roots,
                "budget_reached", watch.ElapsedMilliseconds > 1800 || nodes.Count >= 160,
                "nodes", nodes, "errors", errors,
                "note", "Names are transiently read but never saved. Only lengths and fixed sample hits are saved. Module presence does not prove the active render path.");
        }

        private static void Walk(AutomationElement element, int depth, IntPtr root, HashSet<int> pids,
            List<Dictionary<string, object>> nodes, List<string> errors, Stopwatch watch, Func<bool> stillScoped)
        {
            if (!stillScoped() || element == null || depth > 6 || nodes.Count >= 160 || watch.ElapsedMilliseconds > 1800) return;
            try
            {
                AutomationElement.AutomationElementInformation info = element.Current;
                if (!pids.Contains(info.ProcessId)) return;
                bool password = info.IsPassword;
                if (!stillScoped()) return;
                string name = password ? "" : (info.Name ?? "");
                if (!stillScoped()) return;
                List<string> hits = new List<string>();
                if (!password)
                    foreach (string sample in Samples)
                        if (name.IndexOf(sample, StringComparison.OrdinalIgnoreCase) >= 0) hits.Add(sample);
                List<string> patterns = new List<string>();
                foreach (AutomationPattern p in element.GetSupportedPatterns()) patterns.Add(p.ProgrammaticName);
                System.Windows.Rect r = info.BoundingRectangle;
                Dictionary<string, object> node = Entry.Obj("root_hwnd", Native.Hex(root), "depth", depth,
                    "pid", info.ProcessId, "class_name", info.ClassName, "framework_id", info.FrameworkId,
                    "control_type", info.ControlType.ProgrammaticName, "is_password", password,
                    "name_length", password ? 0 : name.Length, "fixed_sample_hits", hits,
                    "is_offscreen", info.IsOffscreen, "patterns", patterns);
                if (!r.IsEmpty && !double.IsInfinity(r.X) && !double.IsInfinity(r.Y))
                    node["rectangle"] = new double[] { r.X, r.Y, r.Width, r.Height };
                if (!stillScoped()) return;
                nodes.Add(node);
                // Do not read protected nodes or their children, ValuePattern, TextPattern,
                // clipboard, window titles, or the test edit box contents.
                if (password) return;
                if (!stillScoped()) return;
                TreeWalker walker = TreeWalker.RawViewWalker;
                AutomationElement child = walker.GetFirstChild(element);
                int siblings = 0;
                while (stillScoped() && child != null && siblings++ < 100 && nodes.Count < 160 && watch.ElapsedMilliseconds <= 1800)
                {
                    Walk(child, depth + 1, root, pids, nodes, errors, watch, stillScoped);
                    if (!stillScoped()) return;
                    child = walker.GetNextSibling(child);
                }
            }
            catch (Exception e) { errors.Add(Entry.ErrorTag(e)); }
        }
    }

    // A capture ticket is permanently revoked when the controlled editor loses its
    // scope. A fresh capture cannot revive an old ticket, including after a quick
    // lose/regain-focus cycle between timer ticks. This is not a WeType session ID.
    internal sealed class CaptureScope
    {
        private readonly object sync;
        private object current;
        internal CaptureScope(object synchronization) { sync = synchronization; }
        internal object Begin()
        { lock (sync) { current = new object(); return current; } }
        internal void Invalidate()
        { lock (sync) { current = null; } }
        internal bool IsCurrent(object ticket)
        { lock (sync) { return ticket != null && Object.ReferenceEquals(ticket, current); } }
        internal bool TryPublish(object ticket, Func<bool> eligible, Action publish)
        {
            lock (sync)
            {
                if (ticket == null || !Object.ReferenceEquals(ticket, current) || !eligible()) return false;
                current = null; // At most one publication for one capture.
                publish();
                return true;
            }
        }
    }

    internal sealed class ProbeForm : Form
    {
        private readonly string output;
        private readonly object sync = new object();
        private readonly List<Dictionary<string, object>> frames = new List<Dictionary<string, object>>();
        private readonly List<Dictionary<string, object>> accessibility = new List<Dictionary<string, object>>();
        private List<Dictionary<string, object>> initialProcesses;
        private TextBox input;
        private CheckBox allowAccessibility;
        private Label status;
        private Button start, finish;
        private System.Windows.Forms.Timer timer;
        private Stopwatch clock;
        private HashSet<int> pids = new HashSet<int>();
        private long lastPidRefresh, lastFrame, lastAccessibility;
        private volatile bool uiaBusy, saving;
        private bool started, saved, optedIn;
        private int focusedTicks;
        private readonly CaptureScope scope;
        private volatile bool editorFocused;
        
        internal ProbeForm(string folder)
        {
            output = folder;
            scope = new CaptureScope(sync);
            Text = "WeType cloud test editor - read-only discovery";
            Width = 900; Height = 640; MinimumSize = new Size(700, 500);
            StartPosition = FormStartPosition.CenterScreen;
            AutoScaleMode = AutoScaleMode.Font;
            Font = new Font("Microsoft YaHei UI", 10F);
            TableLayoutPanel layout = new TableLayoutPanel();
            layout.Dock = DockStyle.Fill; layout.Padding = new Padding(20);
            layout.ColumnCount = 1; layout.RowCount = 7;
            layout.RowStyles.Add(new RowStyle(SizeType.AutoSize));
            layout.RowStyles.Add(new RowStyle(SizeType.AutoSize));
            layout.RowStyles.Add(new RowStyle(SizeType.AutoSize));
            layout.RowStyles.Add(new RowStyle(SizeType.Percent, 100));
            layout.RowStyles.Add(new RowStyle(SizeType.AutoSize));
            layout.RowStyles.Add(new RowStyle(SizeType.AutoSize));
            layout.RowStyles.Add(new RowStyle(SizeType.AutoSize));
            Label title = new Label(); title.AutoSize = true;
            title.Text = "定位微信原候选窗口，不修改输入法";
            title.Font = new Font(Font.FontFamily, 15F, FontStyle.Bold);
            title.Margin = new Padding(0, 0, 0, 12); layout.Controls.Add(title, 0, 0);
            Label instructions = new Label(); instructions.AutoSize = true;
            instructions.Text = "1. 点击下面的开始按钮，在测试框用 Win+空格切到微信输入法。\r\n"
                + "2. 依次敲 kaifa、xuexi、cidian；每次让候选框保持约两秒，再选词。\r\n"
                + "3. 试一次候选翻页、鼠标选词和 Esc 取消。只输入测试词，不输入私人内容。\r\n"
                + "4. 点击结束并保存。最多采集60秒；离开本测试窗口就暂停采集。";
            instructions.Margin = new Padding(0, 0, 0, 12); layout.Controls.Add(instructions, 0, 1);
            allowAccessibility = new CheckBox(); allowAccessibility.AutoSize = true;
            allowAccessibility.Text = "允许读取候选辅助功能节点（不保存原文，只保存测试词命中及长度）";
            allowAccessibility.Checked = false; allowAccessibility.Margin = new Padding(0, 0, 0, 12);
            layout.Controls.Add(allowAccessibility, 0, 2);
            input = new TextBox(); input.Multiline = true; input.Dock = DockStyle.Fill;
            input.Font = new Font(Font.FontFamily, 15F); input.ScrollBars = ScrollBars.Vertical;
            input.GotFocus += delegate { editorFocused = true; };
            input.LostFocus += InvalidateScope;
            input.HandleDestroyed += InvalidateScope;
            Deactivate += InvalidateScope;
            HandleDestroyed += InvalidateScope;
            layout.Controls.Add(input, 0, 3);
            FlowLayoutPanel buttons = new FlowLayoutPanel(); buttons.AutoSize = true;
            buttons.Dock = DockStyle.Fill; buttons.Margin = new Padding(0, 12, 0, 8);
            start = new Button(); start.Text = "开始只读诊断"; start.AutoSize = true;
            finish = new Button(); finish.Text = "结束并保存"; finish.AutoSize = true;
            start.Click += Start; finish.Click += delegate { Close(); };
            buttons.Controls.Add(start); buttons.Controls.Add(finish); layout.Controls.Add(buttons, 0, 4);
            status = new Label(); status.AutoSize = true; status.Text = "尚未开始。建议勾选辅助功能检查，以判断候选文字是否可访问。";
            layout.Controls.Add(status, 0, 5);
            Label privacy = new Label(); privacy.AutoSize = true;
            privacy.Text = "无联网 / 无截图 / 无键盘钩子 / 不读剪贴板及词库 / 不写目标进程 / 不设置开机启动。\r\n"
                + "结果仅保存在解压目录 reports 中；本窗口不是候选窗替代品，也不会显示译词。";
            privacy.Margin = new Padding(0, 12, 0, 0); layout.Controls.Add(privacy, 0, 6);
            Controls.Add(layout);
            timer = new System.Windows.Forms.Timer(); timer.Interval = 300; timer.Tick += Tick;
            FormClosing += delegate { InvalidateScope(this, EventArgs.Empty); Save(); };
        }

        private void InvalidateScope(object sender, EventArgs args)
        {
            lock (sync) { editorFocused = false; scope.Invalidate(); }
        }

        private void Start(object sender, EventArgs args)
        {
            if (started) return;
            start.Enabled = false; allowAccessibility.Enabled = false;
            optedIn = allowAccessibility.Checked;
            status.Text = "正在读取输入法进程版本和模块名称…";
            initialProcesses = Inventory.Read();
            pids = Inventory.Pids();
            clock = Stopwatch.StartNew(); started = true;
            lastPidRefresh = -3000; lastFrame = -2000; lastAccessibility = -3000;
            input.Focus(); timer.Start();
        }

        private void Tick(object sender, EventArgs args)
        {
            if (!started || saving) return;
            if (clock.ElapsedMilliseconds >= 60000) { timer.Stop(); Close(); return; }
            bool focus = input.Focused && Native.GetForegroundWindow() == Handle
                && !input.UseSystemPasswordChar && input.PasswordChar == '\0';
            status.Text = "已运行 " + (clock.ElapsedMilliseconds / 1000) + " 秒；窗口采样 " + frames.Count
                + "；" + (focus ? "仅采集本测试场景" : "已暂停：请回到测试框") ;
            if (!focus) { InvalidateScope(this, EventArgs.Empty); return; }
            editorFocused = true;
            focusedTicks++;
            if (clock.ElapsedMilliseconds - lastPidRefresh >= 2000)
            { pids = Inventory.Pids(); lastPidRefresh = clock.ElapsedMilliseconds; }
            if (clock.ElapsedMilliseconds - lastFrame < 850) return;
            lastFrame = clock.ElapsedMilliseconds;
            List<WindowInfo> windows = Native.Windows(pids);
            List<Dictionary<string, object>> values = new List<Dictionary<string, object>>();
            foreach (WindowInfo w in windows) values.Add(w.Data);
            Dictionary<string, object> imm = StandardImeCandidates.Read(input.Handle);
            // A native/provider call can pump messages; recheck after synchronous reads.
            if (!input.Focused || Native.GetForegroundWindow() != Handle || saving
                || input.UseSystemPasswordChar || input.PasswordChar != '\0')
            { InvalidateScope(this, EventArgs.Empty); return; }
            frames.Add(Entry.Obj("elapsed_ms", clock.ElapsedMilliseconds, "windows", values,
                "target_process_count", pids.Count, "standard_imm_candidates", imm));
            if (!optedIn || uiaBusy || windows.Count == 0 || clock.ElapsedMilliseconds - lastAccessibility < 1800) return;
            lastAccessibility = clock.ElapsedMilliseconds;
            long captureTime = clock.ElapsedMilliseconds;
            HashSet<int> allowed = new HashSet<int>(pids);
            IntPtr scopedHost = Handle;
            object scopedTicket = scope.Begin();
            uiaBusy = true;
            // One worker at a time. A stuck provider cannot block the UI or spawn more workers.
            Thread worker = new Thread(delegate()
            {
                Dictionary<string, object> captured;
                Func<bool> eligible = delegate { return !saving && editorFocused && Native.GetForegroundWindow() == scopedHost; };
                Func<bool> stillScoped = delegate { return scope.IsCurrent(scopedTicket) && eligible(); };
                try { captured = Accessibility.Read(windows, allowed, stillScoped); }
                catch (Exception e) { captured = Entry.Obj("error", Entry.ErrorTag(e)); }
                captured["elapsed_from_start_ms"] = captureTime;
                scope.TryPublish(scopedTicket, eligible, delegate { accessibility.Add(captured); });
                uiaBusy = false;
            });
            worker.IsBackground = true; worker.SetApartmentState(ApartmentState.MTA); worker.Start();
        }

        private void Save()
        {
            if (saved) return;
            timer.Stop();
            lock (sync) { saving = true; editorFocused = false; scope.Invalidate(); }
            try
            {
                List<Dictionary<string, object>> finalProcesses = started ? Inventory.Read() : new List<Dictionary<string, object>>();
                Dictionary<string, object> report;
                lock (sync)
                {
                    report = Entry.Obj("schema_version", 2, "tool", "WeType-NativeCandidate-Cloud-P1",
                        "capability", "read_only_diagnostics_NOT_a_translation_patch",
                        "utc_saved", DateTime.UtcNow.ToString("o"), "started", started,
                        "duration_ms", clock == null ? 0 : clock.ElapsedMilliseconds,
                        "focused_sample_ticks", focusedTicks, "os_version_api", Environment.OSVersion.Version.ToString(),
                        "is_64bit_process", Environment.Is64BitProcess, "uia_opt_in", optedIn,
                        "uia_worker_pending_at_save", uiaBusy, "processes_at_start", initialProcesses,
                        "processes_at_end", finalProcesses,
                        "window_frames", frames, "accessibility_frames", new List<Dictionary<string, object>>(accessibility),
                        "limitations", new string[] {
                            "Process names are discovery hints, not verified patch targets.",
                            "No foreground titles, full paths, keystrokes, clipboard, typed text or dictionary files are saved.",
                            "UIA capture tickets are revoked by editor focus loss, host deactivation, closing and handle destruction; in-flight provider calls cannot be interrupted, but revoked results are discarded.",
                            "IMM polling and accessibility sample hits are diagnostics, not authoritative WeType candidate events or session identities.",
                            "An unresponsive UIA call can outlast the soft time budget; it runs on one background worker only.",
                            "Missing windows or sample hits do not prove that native modification is impossible.",
                            "Rectangle coordinates follow the diagnostic process DPI context, not a proven physical-pixel mapping.",
                            "Loaded libraries suggest frameworks but do not establish the active candidate render function.",
                            "No compatibility success is asserted and no WeType code or process memory is modified." });
                }
                Entry.WriteJson(Path.Combine(output, "report.json"), report);
                saved = true;
            }
            catch (Exception e)
            { MessageBox.Show("保存失败：" + Entry.ErrorTag(e) + "。请保留控制台错误。", "诊断保存失败"); }
        }

        protected override void Dispose(bool disposing)
        {
            if (disposing) { InvalidateScope(this, EventArgs.Empty); if (timer != null) timer.Dispose(); }
            base.Dispose(disposing);
        }
    }
}
