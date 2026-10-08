import React from 'react'
import i18n from '@dhis2/d2-i18n'

export class StageFormErrorBoundary extends React.Component {
    constructor(props) {
        super(props)
        this.state = { error: null }
    }

    static getDerivedStateFromError(error) {
        return { error }
    }

    componentDidCatch(error, info) {
        console.error('[Capture] Stage form render failed', error, info)
    }

    render() {
        if (this.state.error) {
            return (
                <div
                    className="rounded-lg border border-red-200 bg-red-50 px-4 py-3 text-sm text-red-900"
                    role="alert"
                >
                    <p className="font-semibold">{i18n.t('Form could not be displayed')}</p>
                    <p className="mt-1 font-normal leading-snug">
                        {String(this.state.error?.message || this.state.error)}
                    </p>
                    <button
                        type="button"
                        className="mt-2 text-xs font-medium underline"
                        onClick={() => this.setState({ error: null })}
                    >
                        {i18n.t('Try again')}
                    </button>
                </div>
            )
        }
        return this.props.children
    }
}
