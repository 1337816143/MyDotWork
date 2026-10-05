using System;
using System.Collections.Generic;
using System.Diagnostics;
using System.Drawing;
using System.IO;
using System.Runtime.InteropServices;
using System.Text;
using System.Web.Script.Serialization;
using System.Windows.Forms;

// Controlled native Windows session test only. This is not a candidate window.
// No hooks, network, registry writes, target-process writes or IME changes.
namespace Task9SessionProbe
{
    public static class Entry
    {
        [DllImport("user32.dll", SetLastError=true)] static extern IntPtr OpenInputDesktop(uint flags, bool inherit, uint access);
        [DllImport("user32.dll", SetLastError=true)] static extern bool CloseDesktop(IntPtr desktop);
        [DllImport("user32.dll", CharSet=CharSet.Unicode, SetLastError=true)] static extern bool GetUserObjectInformation(IntPtr handle, int index, StringBuilder value, uint bytes, out uint needed);
        [DllImport("user32.dll")] internal static extern IntPtr GetForegroundWindow();
        [DllImport("user32.dll", CharSet=CharSet.Unicode, SetLastError=true)] static extern IntPtr SendMessageTimeout(IntPtr hwnd, uint msg, IntPtr wParam, IntPtr lParam, uint flags, uint timeout, out IntPtr result);
        [DllImport("user32.dll")] static extern uint GetWindowThreadProcessId(IntPtr hwnd, out uint pid);
        [DllImport("user32.dll")] static extern uint GetDpiForWindow(IntPtr hwnd);

        public static void Run(string path)
        {
            if (Environment.OSVersion.Platform != PlatformID.Win32NT) throw new PlatformNotSupportedException();
            var report = new Dictionary<string, object>();
            report["schema_version"] = 1;
            report["capability"] = "controlled_windows_session_probe_NOT_WeType_validation";
            report["utc"] = DateTime.UtcNow.ToString("o");
            report["user_interactive"] = Environment.UserInteractive;
            report["session_id"] = Process.GetCurrentProcess().SessionId;
            report["os"] = Environment.OSVersion.Version.ToString();
            report["process_64bit"] = Environment.Is64BitProcess;
            var desktop = OpenInputDesktop(0, false, 1); // DESKTOP_READOBJECTS only
            report["input_desktop_open"] = desktop != IntPtr.Zero;
            report["input_desktop_error"] = desktop == IntPtr.Zero ? Marshal.GetLastWin32Error() : 0;
            if (desktop != IntPtr.Zero)
            {
                uint needed; var name = new StringBuilder(256);
                report["input_desktop_name"] = GetUserObjectInformation(desktop, 2, name, 512, out needed) ? name.ToString() : "unavailable";
                CloseDesktop(desktop);
            }
            Application.EnableVisualStyles();
            Application.SetCompatibleTextRenderingDefault(false);
            using (var form = new TestForm(report)) Application.Run(form);
            report["wetype_installed_or_activated"] = false;
            report["native_candidate_read_or_modified"] = false;
            report["limitations"] = new [] { "This tests one fresh hosted Windows session, not Windows 11 compatibility.", "Scoped WM_CHAR tests the own editor message loop, not physical keyboard or IME routing.", "Only the test panel is sampled; no user desktop or input text is retained." };
            var json = new JavaScriptSerializer().Serialize(report);
            File.WriteAllText(path, json, new UTF8Encoding(false));
            Console.WriteLine("TASK9_SESSION_JSON=" + json);
        }

        private sealed class TestForm : Form
        {
            readonly Dictionary<string, object> report;
            readonly Panel pattern = new Panel();
            readonly TextBox input = new TextBox();
            readonly Timer timer = new Timer();
            int phase;
            const string Sample = "wetype_probe_42";
            public TestForm(Dictionary<string, object> output)
            {
                report = output;
                Text = "Controlled cloud session test (not an IME candidate window)";
                ClientSize = new Size(580, 220);
                StartPosition = FormStartPosition.CenterScreen;
                pattern.Location = new Point(20, 20); pattern.Size = new Size(160, 100);
                pattern.Paint += delegate(object sender, PaintEventArgs e) {
                    using (var a = new SolidBrush(Color.Magenta)) e.Graphics.FillRectangle(a, 0, 0, 80, 100);
                    using (var b = new SolidBrush(Color.Lime)) e.Graphics.FillRectangle(b, 80, 0, 80, 100);
                };
                input.Location = new Point(20, 150); input.Width = 530;
                Controls.Add(pattern); Controls.Add(input);
                timer.Interval = 800;
                timer.Tick += Step;
                Shown += delegate { Activate(); input.Focus(); timer.Start(); };
                FormClosed += delegate { timer.Stop(); };
            }
            void Step(object sender, EventArgs e)
            {
                if (phase++ == 0)
                {
                    uint pid; GetWindowThreadProcessId(Handle, out pid);
                    report["test_window_owner_pid_matches"] = pid == Process.GetCurrentProcess().Id;
                    report["test_window_visible"] = Visible;
                    report["test_window_dpi"] = GetDpiForWindow(Handle);
                    bool foreground = GetForegroundWindow() == Handle && input.Focused;
                    report["foreground_editor"] = foreground;
                    report["scoped_control_message_attempted"] = true;
                    try {
                        foreach (char ch in Sample) {
                            IntPtr result;
                            if (SendMessageTimeout(input.Handle, 0x0102, (IntPtr)(int)ch, IntPtr.Zero, 2, 500, out result) == IntPtr.Zero)
                                throw new InvalidOperationException("Scoped WM_CHAR delivery failed");
                        }
                    } catch (Exception x) { report["control_message_error"] = x.GetType().Name; }
                    return;
                }
                timer.Stop();
                report["scoped_control_ascii_received_exactly"] = input.Text == Sample;
                bool foregroundNow = GetForegroundWindow() == Handle;
                report["foreground_at_capture"] = foregroundNow;
                if (foregroundNow)
                {
                    try {
                        using (var bmp = new Bitmap(pattern.Width, pattern.Height))
                        {
                            using (var g = Graphics.FromImage(bmp)) g.CopyFromScreen(pattern.PointToScreen(Point.Empty), Point.Empty, pattern.Size);
                            int magenta=0, lime=0;
                            for (int y=10; y<90; y++) for (int x=10; x<150; x++) {
                                var c = bmp.GetPixel(x,y);
                                if (c.R>230 && c.G<25 && c.B>230) magenta++;
                                if (c.R<25 && c.G>230 && c.B<25) lime++;
                            }
                            report["screen_sample_magenta_pixels"] = magenta;
                            report["screen_sample_lime_pixels"] = lime;
                            report["controlled_render_visible"] = magenta>4000 && lime>4000;
                            // Raw pixels never leave memory; occlusion/focus changes may invalidate this observation.
                            report["foreground_after_capture"] = GetForegroundWindow() == Handle;
                            if (GetForegroundWindow() != Handle) report["controlled_render_visible"] = false;
                        }
                    } catch (Exception x) { report["capture_error"] = x.GetType().Name + ":" + x.HResult; }
                }
                input.Clear();
                Close();
            }
            protected override void Dispose(bool disposing) { if(disposing) timer.Dispose(); base.Dispose(disposing); }
        }
    }
}
