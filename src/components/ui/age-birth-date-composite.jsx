import i18n from '@dhis2/d2-i18n'
import { Input } from './input'
import { DatePicker } from './date-picker'
import { FORM } from '../../lib/formUi'
import { cn } from '../../lib/utils'
import { KhmerVirtualKeyboard } from './khmer-virtual-keyboard'

/**
 * Age (completed years) + date of birth together: type age or pick DOB; values stay in sync.
 */
export function AgeBirthDateComposite({ ageValue, dobIso, onAgeChange, onDobChange, disabled }) {
    const handleAgeInput = (e) => {
        const raw = e.target.value
        onAgeChange(raw)
    }

    return (
        <div className="flex w-full flex-col gap-3 sm:flex-row sm:items-stretch">
            <div className="flex min-w-0 flex-1 flex-col gap-1">
                <span className={cn(FORM.fieldLabel, 'text-xs font-medium text-slate-600')}>
                    {i18n.t('Age (completed years)')}
                </span>
                    <Input
                        type="number"
                        min={0}
                        max={130}
                        inputMode="numeric"
                        value={ageValue}
                        onChange={handleAgeInput}
                        disabled={disabled}
                        className="w-full"
                        placeholder={i18n.t('e.g. 25')}
                        rightElement={
                            !disabled && (
                                <KhmerVirtualKeyboard
                                    onlyNumbers
                                    onInsert={(char) => {
                                        const current = ageValue || ''
                                        onAgeChange(current + char)
                                    }}
                                    onBackspace={() => {
                                        const current = ageValue || ''
                                        if (current.length > 0) {
                                            onAgeChange(current.slice(0, -1))
                                        }
                                    }}
                                />
                            )
                        }
                    />
            </div>
            <div className="flex min-w-0 flex-[1.25] flex-col gap-1">
                <span className={cn(FORM.fieldLabel, 'text-xs font-medium text-slate-600')}>
                    {i18n.t('Or date of birth')}
                </span>
                <DatePicker
                    date={dobIso}
                    setDate={onDobChange}
                    disabled={disabled}
                    placeholder={i18n.t('Pick a date')}
                />
            </div>
        </div>
    )
}