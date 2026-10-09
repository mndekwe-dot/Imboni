import { Component } from 'react'
import { ErrorFallback } from './ErrorFallback'
import { reportError } from '../utils/sentry'

/**
 * The top-level crash screen: when a render throws, show ErrorFallback instead
 * of a blank white page, and report the error if monitoring is switched on.
 *
 * This replaces Sentry.ErrorBoundary. That component did exactly this, but
 * importing it put the whole Sentry SDK on the critical path for every visitor.
 * A boundary has to be a class (React has no hook for it), so this is the small
 * part of that component the app actually used.
 */
export class AppErrorBoundary extends Component {
    state = { error: null }

    static getDerivedStateFromError(error) {
        return { error }
    }

    componentDidCatch(error, info) {
        reportError(error, info)
    }

    resetError = () => this.setState({ error: null })

    render() {
        if (this.state.error) {
            return <ErrorFallback error={this.state.error} resetError={this.resetError} />
        }
        return this.props.children
    }
}
