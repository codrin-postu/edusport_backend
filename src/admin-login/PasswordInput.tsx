import * as React from 'react';
import { Button } from '../admin/ui/Button';
import { Field } from '../admin/ui/Field';
import { Input } from '../admin/ui/Input';
import { SECURITY_COPY } from '../club/security/copy';
import { IconEye, IconEyeOff } from './icons';

type Props = { label: string; value: string; onChange: (v: string) => void; autoComplete: 'current-password' | 'new-password' };

/** A password field with the eye toggle ("Arată parola" / "Ascunde parola"). */
export function PasswordInput({ label, value, onChange, autoComplete }: Props) {
  const [shown, setShown] = React.useState(false);
  const name = shown ? SECURITY_COPY.login.hidePassword : SECURITY_COPY.login.showPassword;
  return (
    <Field label={label}>
      <div className="ia-pass">
        <Input type={shown ? 'text' : 'password'} value={value} autoComplete={autoComplete} onChange={(e) => onChange(e.target.value)} />
        <Button
          className="pce ia-eye"
          variant="ghost"
          size="sm"
          iconOnly
          icon={shown ? <IconEyeOff /> : <IconEye />}
          aria-label={name}
          aria-pressed={shown}
          onClick={() => setShown(!shown)}
        />
      </div>
    </Field>
  );
}
