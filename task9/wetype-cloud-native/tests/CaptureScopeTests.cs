// SYNTHETIC C# state-machine tests. No windows, UIA calls or WeType are used.
// Compile together with NativeProbe.cs to exercise the actual CaptureScope class.
using System;
using System.Threading;

namespace WeTypeNativeProbe
{
    public static class CaptureScopeTests
    {
        private static int assertions;
        private static void Check(bool result, string label)
        { assertions++; if (!result) throw new InvalidOperationException(label); }

        public static void Run()
        {
            assertions = 0;
            var gate = new CaptureScope(new object());
            int publications = 0;
            Check(!gate.IsCurrent(null), "null ticket");
            Check(!gate.TryPublish(null, delegate { return true; }, delegate { publications++; }), "unopened gate");
            object first = gate.Begin();
            Check(gate.IsCurrent(first), "fresh capture");
            gate.Invalidate(); // LostFocus/Deactivate/Closing/HandleDestroyed.
            Check(!gate.IsCurrent(first), "immediate revocation before a timer tick");
            Check(!gate.TryPublish(first, delegate { return true; }, delegate { publications++; }), "refocus cannot revive old capture");
            object second = gate.Begin();
            Check(!gate.IsCurrent(first) && gate.IsCurrent(second), "new capture identity");
            Check(!gate.TryPublish(second, delegate { return false; }, delegate { publications++; }), "current foreground eligibility");
            Check(gate.TryPublish(second, delegate { return true; }, delegate { publications++; }), "one permitted publication");
            Check(!gate.TryPublish(second, delegate { return true; }, delegate { publications++; }), "no replay");
            Check(publications == 1, "only eligible capture was published");
            object superseded = gate.Begin();
            object newer = gate.Begin();
            Check(!gate.IsCurrent(superseded) && gate.IsCurrent(newer), "newer capture supersedes old capture");

            // A provider completing after the UI thread delivered revocation is rejected.
            for (int iteration = 0; iteration < 64; iteration++)
            {
                object ticket = gate.Begin();
                bool accepted = true;
                using (var providerStarted = new ManualResetEvent(false))
                using (var providerFinished = new ManualResetEvent(false))
                {
                    var worker = new Thread(delegate()
                    {
                        providerStarted.Set();
                        if (!providerFinished.WaitOne(5000)) return;
                        accepted = gate.TryPublish(ticket, delegate { return true; }, delegate { publications++; });
                    });
                    worker.IsBackground = true;
                    worker.Start();
                    Check(providerStarted.WaitOne(5000), "provider start timeout");
                    gate.Invalidate();
                    providerFinished.Set();
                    Check(worker.Join(5000), "provider completion timeout");
                }
                Check(!accepted, "late provider result after invalidation");
            }
            Check(publications == 1, "revoked captures never published");
            Console.WriteLine("PASS C# synthetic capture scope: " + assertions + " assertions; NOT a Windows UI/WeType integration test");
        }
    }
}
