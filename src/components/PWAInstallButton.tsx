import React, { useState } from 'react';
import { Download, Smartphone, X } from 'lucide-react';
import { usePWAInstall } from '../hooks/usePWA';

export const PWAInstallButton: React.FC = () => {
  const { isInstallable, isInstalled, isIOS, install } = usePWAInstall();
  const [showIOSGuide, setShowIOSGuide] = useState(false);

  if (isInstalled) return null;

  if (isInstallable) {
    return (
      <button
        type="button"
        onClick={install}
        className="flex items-center gap-1.5 rounded-lg border border-amber-500/50 bg-amber-500/15 px-2.5 py-1.5 text-xs font-medium text-amber-200 transition-colors hover:bg-amber-500/25 whitespace-nowrap shrink-0"
        title="Instalar Equus 3D · ProClaVet para acceso rápido y uso sin conexión"
      >
        <Download className="h-3.5 w-3.5 text-amber-400" />
        <span className="hidden sm:inline">Instalar app</span>
      </button>
    );
  }

  if (isIOS) {
    return (
      <>
        <button
          type="button"
          onClick={() => setShowIOSGuide(true)}
          className="flex items-center gap-1.5 rounded-lg border border-amber-500/50 bg-amber-500/15 px-2.5 py-1.5 text-xs font-medium text-amber-200 transition-colors hover:bg-amber-500/25 whitespace-nowrap shrink-0"
          title="Instalar en iPhone / iPad"
        >
          <Smartphone className="h-3.5 w-3.5 text-amber-400" />
          <span className="hidden sm:inline">Instalar iOS</span>
        </button>

        {showIOSGuide && (
          <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/70 p-4">
            <div className="w-full max-w-sm rounded-xl border border-slate-700 bg-[#0e141d] p-5 shadow-2xl text-slate-100">
              <div className="flex items-center justify-between gap-2">
                <h3 className="text-sm font-semibold">Instalar Equus 3D en iPhone / iPad</h3>
                <button
                  type="button"
                  onClick={() => setShowIOSGuide(false)}
                  className="rounded p-1 text-slate-400 hover:bg-slate-800 hover:text-white"
                  aria-label="Cerrar instrucciones"
                >
                  <X className="h-4 w-4" />
                </button>
              </div>
              <ol className="mt-3 space-y-2 text-xs leading-relaxed text-slate-300 list-decimal pl-4">
                <li>
                  Toca el botón <strong>Compartir</strong> en la barra de Safari.
                </li>
                <li>
                  Desliza hacia abajo y selecciona <strong>Agregar a inicio</strong>.
                </li>
                <li>
                  Confirma con <strong>Agregar</strong> para usar los 12 catálogos incluso sin conexión.
                </li>
              </ol>
              <button
                type="button"
                onClick={() => setShowIOSGuide(false)}
                className="mt-4 w-full rounded-lg bg-amber-500 py-2 text-xs font-semibold text-slate-950 hover:bg-amber-400"
              >
                Entendido
              </button>
            </div>
          </div>
        )}
      </>
    );
  }

  return null;
};
