import React from 'react'
import { LoadingMark } from './loading'
import { cn } from '../../lib/utils'

export const Spinner = ({ className }) => (
    <LoadingMark className={cn('h-4 w-4', className)} />
)
