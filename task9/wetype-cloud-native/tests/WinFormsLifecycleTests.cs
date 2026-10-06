// Actual WinForms event-delivery tests against the unchanged ProbeForm source.
// Only two empty windows owned by this process are used. The diagnostic Start
// button is never pressed: no process inventory, IMM polling or UIA capture runs.
// Controlled delayed workers are test fixtures, not real UIA providers or WeType.
using System;
using System.Diagnostics;
using System.IO;
using System.Reflection;
using System.Threading;
using System.Windows.Forms;

namespace WeTypeNativeProbe
{
    public static class WinFormsLifecycleTests
    {
        private static int assertions;
        private static int publications;
        private static T Field<T>(ProbeForm form, string name)
        {
            FieldInfo field = typeof(ProbeForm).GetField(name, BindingFlags.NonPublic | BindingFlags.Instance);
            if (field == null) throw new InvalidOperationException("Missing test field: " + name);
            return (T)field.GetValue(form);
        }
        private static void Check(bool value, string label)
        {
            assertions++;
            if (!value) throw new InvalidOperationException("WinForms lifecycle: " + label);
        }
        private static void Until(Func<bool> ready, string label)
        {
            Stopwatch watch = Stopwatch.StartNew();
            while (!ready() && watch.ElapsedMilliseconds < 3000)
            {
                Application.DoEvents();
                Thread.Sleep(10);
            }
            Check(ready(), label);
        }
        private static void FocusEditor(ProbeForm form, TextBox input)
        {
            form.Activate();
            input.Focus();
            Until(delegate { return input.Focused && Native.GetForegroundWindow() == form.Handle; }, "own editor foreground");
            Check(Field<bool>(form, "editorFocused"), "real GotFocus handler ran");
        }
        private static void Recreate(Control control)
        {
            MethodInfo recreate = typeof(Control).GetMethod("RecreateHandle", BindingFlags.NonPublic | BindingFlags.Instance);
            if (recreate == null) throw new InvalidOperationException("Control.RecreateHandle unavailable");
            recreate.Invoke(control, null);
        }
        private static void Reject(CaptureScope scope, object ticket, string label)
        {
            Check(!scope.IsCurrent(ticket), label + " permanently invalid");
            Check(!scope.TryPublish(ticket, delegate { return true; }, delegate { publications++; }), label + " cannot publish");
        }
        public static void Run(string outputDirectory)
        {
            if (Environment.OSVersion.Platform != PlatformID.Win32NT) throw new PlatformNotSupportedException();
            assertions = 0;
            publications = 0;
            Check(Thread.CurrentThread.GetApartmentState() == ApartmentState.STA, "STA thread");
            Directory.CreateDirectory(outputDirectory);
            Application.EnableVisualStyles();
            Application.SetCompatibleTextRenderingDefault(false);
            using (var form = new ProbeForm(outputDirectory))
            using (var companion = new Form())
            {
                companion.Text = "Task9 owned focus target";
                companion.Width = 260;
                companion.Height = 140;
                TextBox input = Field<TextBox>(form, "input");
                CaptureScope scope = Field<CaptureScope>(form, "scope");
                int lostFocus = 0, deactivated = 0, inputDestroyed = 0, hostDestroyed = 0, closing = 0;
                input.LostFocus += delegate { lostFocus++; };
                input.HandleDestroyed += delegate { inputDestroyed++; };
                form.Deactivate += delegate { deactivated++; };
                form.HandleDestroyed += delegate { hostDestroyed++; };
                form.FormClosing += delegate { closing++; };
                form.Show();
                FocusEditor(form, input);
                Check(!Field<bool>(form, "started"), "diagnostic sampler not started");
                Check(!Field<System.Windows.Forms.Timer>(form, "timer").Enabled, "sampling timer disabled");

                object tabTicket = scope.Begin();
                Message tab = Message.Create(input.Handle, 0x0100, (IntPtr)(int)Keys.Tab, IntPtr.Zero);
                // Invoke WinForms' real dialog-key preprocessing on our own editor.
                // This is not global or physical keyboard injection.
                Check(input.PreProcessMessage(ref tab), "Tab handled by WinForms dialog navigation");
                Check(!input.Focused && lostFocus > 0, "Tab delivered actual same-window LostFocus");
                Check(Native.GetForegroundWindow() == form.Handle, "same host remained foreground after Tab");
                Check(!Field<bool>(form, "editorFocused"), "LostFocus cleared eligibility before polling");
                Reject(scope, tabTicket, "same-window Tab");
                FocusEditor(form, input);
                Reject(scope, tabTicket, "Tab then refocus");
                Console.WriteLine("TASK9_UI_CASE=same_window_tab_and_refocus:passed");

                object deactivationTicket = scope.Begin();
                companion.Show();
                companion.Activate();
                Until(delegate { return Native.GetForegroundWindow() == companion.Handle; }, "own companion foreground");
                Check(deactivated > 0, "actual host Deactivate event");
                Reject(scope, deactivationTicket, "deactivation");
                FocusEditor(form, input);
                Reject(scope, deactivationTicket, "deactivation then regain");
                Check(!Field<System.Windows.Forms.Timer>(form, "timer").Enabled, "loss/regain independent of polling");
                Console.WriteLine("TASK9_UI_CASE=deactivate_and_regain_without_polling:passed");

                object inputHandleTicket = scope.Begin();
                Recreate(input);
                Check(inputDestroyed > 0, "actual editor HandleDestroyed event");
                Reject(scope, inputHandleTicket, "editor handle recreation");
                FocusEditor(form, input);
                Reject(scope, inputHandleTicket, "editor handle recreation then refocus");
                object hostHandleTicket = scope.Begin();
                Recreate(form);
                Check(hostDestroyed > 0, "actual host HandleDestroyed event");
                Reject(scope, hostHandleTicket, "host handle recreation");
                FocusEditor(form, input);
                Reject(scope, hostHandleTicket, "host handle recreation then refocus");
                Console.WriteLine("TASK9_UI_CASE=editor_and_host_handle_recreation:passed");

                object activeTicket = scope.Begin();
                Check(scope.TryPublish(activeTicket, delegate { return input.Focused && Field<bool>(form, "editorFocused"); }, delegate { publications++; }), "fresh eligible capture still publishes");
                Check(!scope.TryPublish(activeTicket, delegate { return true; }, delegate { publications++; }), "published capture cannot replay");
                object lateTicket = scope.Begin();
                bool accepted = true;
                using (var ready = new ManualResetEvent(false))
                using (var release = new ManualResetEvent(false))
                {
                    Thread worker = new Thread(delegate()
                    {
                        ready.Set();
                        if (!release.WaitOne(5000)) return;
                        accepted = scope.TryPublish(lateTicket, delegate { return true; }, delegate { publications++; });
                    });
                    worker.IsBackground = true;
                    worker.Start();
                    Check(ready.WaitOne(5000), "controlled worker ready");
                    try
                    {
                        form.Close();
                        Check(closing == 1, "actual FormClosing event");
                        Check(Field<bool>(form, "saving"), "Save revoked scope");
                        Reject(scope, lateTicket, "close while controlled worker delayed");
                    }
                    finally { release.Set(); }
                    Check(worker.Join(5000), "controlled worker joined");
                }
                Check(!accepted && publications == 1, "late result rejected, fresh result preserved");
                Check(Field<System.Collections.Generic.List<System.Collections.Generic.Dictionary<string, object>>>(form, "frames").Count == 0, "no candidate polling frames");
                Check(Field<System.Collections.Generic.List<System.Collections.Generic.Dictionary<string, object>>>(form, "accessibility").Count == 0, "no UIA capture frames");
                Console.WriteLine("TASK9_UI_CASE=close_during_controlled_delayed_completion:passed");
                companion.Close();
            }
            Console.WriteLine("TASK9_UI_LIFECYCLE_RESULT=passed; assertions=" + assertions + "; real_WeType=false; real_UIA_provider=false; physical_keyboard=false");
        }
    }
}
