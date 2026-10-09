/** List controls over the existing staged engine and language string fields. */
import { type SettingsFieldState } from '@deepseek-ai/dsh-client-ui-primitives';
import type { SearxngSearchSettingsLocaleKey } from './locales.ts';
type Translate = (key: SearxngSearchSettingsLocaleKey) => string;
interface ChoiceFieldProps {
    t: Translate;
    state: SettingsFieldState;
    disabled: boolean;
    onEdit: (text: string) => void;
    onReset: () => void;
}
/** Engine checkboxes grouped by search purpose; custom selections survive every list edit. */
export declare function EngineChoiceField(props: ChoiceFieldProps): import("react").JSX.Element;
/** Language dropdown with a custom-code escape hatch for existing or uncommon languages. */
export declare function LanguageChoiceField(props: ChoiceFieldProps): import("react").JSX.Element;
export {};
//# sourceMappingURL=SearchChoiceFields.d.ts.map