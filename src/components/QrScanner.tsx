/**
 * @license
 * SPDX-License-Identifier: Apache-2.0
 */

import React, { useState, useEffect } from "react";
import { Camera, QrCode, X, Sparkles } from "lucide-react";

interface QrScannerProps {
  activeTab: "murid" | "guru";
  onScanSuccess: (data: {
    type?: "murid" | "guru";
    id: string; // nis or nip
    nama?: string;
    kelasOrJabatan?: string;
  }) => void;
  onClose: () => void;
}

export default function QrScanner({
  activeTab,
  onScanSuccess,
  onClose,
}: QrScannerProps) {
  const [isScanning, setIsScanning] = useState<boolean>(true);
  const [scanSuccessOverlay, setScanSuccessOverlay] = useState<boolean>(false);

  // State for mock simulation presets
  const mockPresets = {
    murid: [
      {
        label: "Siswa: Muhammad Fadli (12998374)",
        value: JSON.stringify({
          type: "murid",
          id: "12998374",
          nama: "Muhammad Fadli",
          kelasOrJabatan: "12-A",
        }),
      },
      {
        label: "Siswa: Siti Rahmawati (12998375)",
        value: JSON.stringify({
          type: "murid",
          id: "12998375",
          nama: "Siti Rahmawati",
          kelasOrJabatan: "10-B",
        }),
      },
      { label: "Siswa NIS Saja (12998500)", value: "12998500" },
    ],
    guru: [
      {
        label: "Guru: Drs. Bambang Wijaya (19780512)",
        value: JSON.stringify({
          type: "guru",
          id: "19780512",
          nama: "Drs. Bambang Wijaya, M.Pd.",
          kelasOrJabatan: "Guru Kimia / Kepala Bagian TU",
        }),
      },
      {
        label: "Guru: Abdul Rahman (19821104)",
        value: JSON.stringify({
          type: "guru",
          id: "19821104",
          nama: "Abdul Rahman, M.Kom",
          kelasOrJabatan: "Guru Informatika",
        }),
      },
      { label: "Guru NIP Saja (19850320)", value: "19850320" },
    ],
  };

  const handleDecodedText = (text: string) => {
    // Sound effect simulation
    try {
      const audioCtx = new (
        window.AudioContext || (window as any).webkitAudioContext
      )();
      const osc = audioCtx.createOscillator();
      const gain = audioCtx.createGain();
      osc.type = "sine";
      osc.frequency.setValueAtTime(1200, audioCtx.currentTime);
      gain.gain.setValueAtTime(0.1, audioCtx.currentTime);
      osc.connect(gain);
      gain.connect(audioCtx.destination);
      osc.start();
      osc.stop(audioCtx.currentTime + 0.1);

      // Add a higher pitch beep for success
      const osc2 = audioCtx.createOscillator();
      const gain2 = audioCtx.createGain();
      osc2.type = "square";
      osc2.frequency.setValueAtTime(1800, audioCtx.currentTime + 0.1);
      gain2.gain.setValueAtTime(0.05, audioCtx.currentTime + 0.1);
      osc2.connect(gain2);
      gain2.connect(audioCtx.destination);
      osc2.start(audioCtx.currentTime + 0.1);
      osc2.stop(audioCtx.currentTime + 0.2);
    } catch (e) {
      // Audio fallback
    }

    setIsScanning(false);
    setScanSuccessOverlay(true);

    setTimeout(() => {
      // Parse output
      try {
        const parsed = JSON.parse(text);
        if (parsed && typeof parsed === "object") {
          onScanSuccess({
            type: parsed.type || activeTab,
            id: String(parsed.id || parsed.nis || parsed.nip || ""),
            nama: parsed.nama || parsed.name,
            kelasOrJabatan:
              parsed.kelasOrJabatan || parsed.kelas || parsed.jabatan,
          });
          return;
        }
      } catch (e) {
        // Not a JSON string
      }

      onScanSuccess({
        type: activeTab,
        id: text.trim(),
      });
    }, 500); // Wait for the visual effect to finish
  };

  return (
    <div className="bg-slate-50 rounded-2xl border border-slate-200/80 p-4 mb-4 select-none animate-fadeIn h-full flex flex-col">
      <div className="flex items-center justify-between mb-3 pb-2 border-b border-slate-200/50 shrink-0">
        <div className="flex items-center gap-2">
          <QrCode size={18} className="text-indigo-600" />
          <h3 className="text-xs font-bold font-mono tracking-wider text-slate-800 uppercase">
            Scanner QR Absensi
          </h3>
        </div>
        {onClose && (
          <button
            type="button"
            onClick={onClose}
            className="text-slate-400 hover:text-slate-600 p-1 rounded-full hover:bg-slate-200/50 cursor-pointer transition-all"
          >
            <X size={16} />
          </button>
        )}
      </div>

      <div className="space-y-4 flex-1 flex flex-col">
        {/* Real Camera Feed Box - Simulated with CSS */}
        <div className="relative bg-slate-900 rounded-xl overflow-hidden shadow-inner flex-1 min-h-[300px] flex flex-col items-center justify-center -mx-1 sm:mx-0">
          {/* Simulated Camera Video Background */}
          {isScanning ? (
            <div className="absolute inset-0 w-full h-full object-cover">
              {/* Blur/noise simulation */}
              <div className="absolute inset-0 mix-blend-overlay opacity-30 bg-repeat bg-[url('data:image/svg+xml;base64,PHN2ZyB4bWxucz0iaHR0cDovL3d3dy53My5vcmcvMjAwMC9zdmciIHdpZHRoPSI0IiBoZWlnaHQ9IjQiPjxyZWN0IHdpZHRoPSI0IiBoZWlnaHQ9IjQiIGZpbGw9IiNmZmYiIGZpbGwtb3BhY2l0eT0iMC4wNSIvPjxyZWN0IHdpZHRoPSIxIiBoZWlnaHQ9IjEiIGZpbGw9IiMwMDAiIGZpbGwtb3BhY2l0eT0iMC4xIi8+PC9zdmc+')]"></div>
              {/* Moving camera pan simulation */}
              <div className="absolute w-[200%] h-[200%] -top-[50%] -left-[50%] animate-pan-camera bg-gradient-to-br from-slate-900 via-slate-800 to-indigo-950 opacity-90"></div>
            </div>
          ) : (
            <div className="absolute inset-0 bg-slate-950 flex items-center justify-center">
              <span className="text-white font-mono text-sm opacity-50">
                Scanner Jeda
              </span>
            </div>
          )}

          {isScanning && (
            <div className="absolute inset-0 flex items-center justify-center pointer-events-none p-4 z-10">
              <div className="relative w-48 h-48 sm:w-64 sm:h-64 flex flex-col">
                <div className="flex justify-between animate-[pulse_2s_ease-in-out_infinite]">
                  <div className="w-8 h-8 sm:w-12 sm:h-12 border-t-[5px] border-l-[5px] border-emerald-400 rounded-tl-2xl opacity-100 drop-shadow-[0_0_12px_rgba(52,211,153,1)]"></div>
                  <div className="w-8 h-8 sm:w-12 sm:h-12 border-t-[5px] border-r-[5px] border-emerald-400 rounded-tr-2xl opacity-100 drop-shadow-[0_0_12px_rgba(52,211,153,1)]"></div>
                </div>

                {/* CSS animation line for scanning - High Tech Laser effect */}
                <div className="absolute left-0 right-0 animate-scan-line z-20 flex flex-col items-center">
                  <div className="w-full h-[3px] bg-emerald-300 shadow-[0_0_15px_4px_rgba(52,211,153,0.9)] rounded-full"></div>
                  <div className="w-full h-16 bg-gradient-to-b from-emerald-400/40 via-emerald-500/10 to-transparent blur-[1px] -mt-[1px]"></div>
                </div>

                <div className="flex-1 flex items-center justify-center">
                  <div className="flex flex-col items-center gap-2">
                    <p className="text-center text-[11px] text-emerald-300 font-bold uppercase tracking-widest animate-pulse font-mono leading-none z-30 bg-slate-900/80 px-4 py-2 rounded-xl border border-emerald-500/50 backdrop-blur-md shadow-2xl flex items-center gap-2">
                      <span className="w-2 h-2 rounded-full bg-emerald-400 animate-ping"></span>
                      SIAP MEMINDAI QR
                    </p>
                    <p className="text-[9px] text-emerald-500/70 font-mono font-semibold tracking-wider text-center">ARAHKAN KAMERA KE KODE</p>
                  </div>
                </div>

                <div className="flex justify-between mt-auto animate-[pulse_2s_ease-in-out_infinite]">
                  <div className="w-8 h-8 sm:w-12 sm:h-12 border-b-[5px] border-l-[5px] border-emerald-400 rounded-bl-2xl opacity-100 drop-shadow-[0_0_12px_rgba(52,211,153,1)]"></div>
                  <div className="w-8 h-8 sm:w-12 sm:h-12 border-b-[5px] border-r-[5px] border-emerald-400 rounded-br-2xl opacity-100 drop-shadow-[0_0_12px_rgba(52,211,153,1)]"></div>
                </div>
              </div>
            </div>
          )}

          {scanSuccessOverlay && (
            <div className="absolute inset-0 z-50 flex items-center justify-center">
              <div className="absolute inset-0 bg-emerald-500/20 backdrop-blur-sm animate-pulse"></div>
              <div className="absolute inset-0 bg-gradient-to-t from-emerald-500/40 via-transparent to-transparent animate-[panCamera_0.5s_ease-out]"></div>
              <div className="relative bg-emerald-500 text-white p-4 rounded-full shadow-[0_0_30px_10px_rgba(52,211,153,0.6)] animate-[popIn_0.3s_cubic-bezier(0.16,1,0.3,1)] flex items-center gap-2">
                <Sparkles
                  size={24}
                  className="animate-spin"
                  style={{ animationDuration: "3s" }}
                />
                <span className="font-bold font-mono tracking-wider">
                  BERHASIL DIPINDAI
                </span>
              </div>
            </div>
          )}
        </div>

        {/* Demo Simulator Section - Fits cleanly inside the mockup constraints */}
        <div className="bg-indigo-50/50 p-3 rounded-xl border border-indigo-100/60 shrink-0">
          <div className="flex items-center gap-1 text-indigo-950 text-[10px] font-bold tracking-wider uppercase mb-2">
            <Sparkles size={11} className="text-indigo-600" />
            <span>Pilih Data Scan Manual</span>
          </div>
          <p className="text-[10px] text-slate-500 mb-2 leading-snug">
            Klik data siswa/guru di bawah ini untuk mengisi data scan
            secara manual tanpa menggunakan kamera sungguhan:
          </p>
          <div className="grid grid-cols-1 sm:grid-cols-2 gap-2">
            {mockPresets[activeTab].map((p, idx) => (
              <button
                key={idx}
                type="button"
                onClick={() => handleDecodedText(p.value)}
                className="w-full text-left bg-white hover:bg-indigo-50 border border-slate-200 hover:border-indigo-300 text-slate-700 hover:text-indigo-900 rounded-lg py-2 px-2.5 text-[11px] font-semibold transition-all shadow-sm flex flex-col justify-center cursor-pointer"
              >
                <span className="truncate w-full">{p.label}</span>
              </button>
            ))}
          </div>
        </div>
      </div>
    </div>
  );
}
