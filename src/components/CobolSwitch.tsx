import React, { useEffect, useId } from 'react';
import type { CobolFormatMode } from '../types/schema';

export interface CobolSwitchProps {
  format: CobolFormatMode;
  onChange: (nextFormat: CobolFormatMode) => void;
  disabled?: boolean;
}

export const CobolSwitch: React.FC<CobolSwitchProps> = ({
  format,
  onChange,
  disabled = false,
}) => {
  const switchId = useId();
  const isFixed = format === 'fixed';

  useEffect(() => {
    if (
      typeof HTMLInputElement !== 'undefined' &&
      !('switch' in HTMLInputElement.prototype)
    ) {
      import('input-switch-polyfill');
      import('input-switch-polyfill/input-switch-polyfill.css');
    }
  }, []);

  return (
    <div className="cobol-switch-control">
      <label htmlFor={switchId} className="cobol-switch-label">
        <span>Fixed-Format (Cols 7–72)</span>
        <input
          id={switchId}
          type="checkbox"
          {...({ switch: '' } as Record<string, string>)}
          checked={isFixed}
          disabled={disabled}
          onChange={(e) => onChange(e.currentTarget.checked ? 'fixed' : 'free')}
        />
      </label>
      <span
        className={`cobol-format-badge ${isFixed ? 'is-fixed' : 'is-free'}`}
        aria-live="polite"
      >
        {isFixed ? 'FIXED' : 'FREE'}
      </span>
    </div>
  );
};
