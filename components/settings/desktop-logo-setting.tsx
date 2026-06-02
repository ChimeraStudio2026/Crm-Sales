'use client';

import { Monitor } from 'lucide-react';
import { CrmLogo } from '@/components/ui/crm-logo';
import {
  MAX_LOGO_DESKTOP_SIZE,
  MIN_LOGO_DESKTOP_SIZE,
} from '@/lib/crm/ui-preferences';
import { useUiPreferences } from '@/providers/ui-preferences-provider';

export function DesktopLogoSetting() {
  const { logoDesktopSize, setLogoDesktopSize } = useUiPreferences();

  return (
    <div className="glass-card">
      <div className="chart-header">
        <h3><Monitor size={20} /> Aspetto desktop</h3>
      </div>
      <p className="settings-copy">
        Regola la dimensione del logo nella sidebar su schermi desktop. La preferenza resta salvata su questo browser.
      </p>
      <div className="settings-logo-preview">
        <div
          className="logo-icon settings-logo-preview-icon"
          style={{ width: logoDesktopSize, height: logoDesktopSize }}
        >
          <CrmLogo size={logoDesktopSize} />
        </div>
        <span className="logo-text">CRM Sales</span>
      </div>
      <div className="settings-range-field">
        <label htmlFor="logo-desktop-size">Dimensione logo</label>
        <div className="settings-range-row">
          <input
            id="logo-desktop-size"
            type="range"
            min={MIN_LOGO_DESKTOP_SIZE}
            max={MAX_LOGO_DESKTOP_SIZE}
            step={1}
            value={logoDesktopSize}
            onChange={(event) => setLogoDesktopSize(Number(event.target.value))}
            className="settings-range-input"
          />
          <span className="settings-range-value">{logoDesktopSize}px</span>
        </div>
      </div>
    </div>
  );
}
