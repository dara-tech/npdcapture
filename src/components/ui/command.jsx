import * as React from 'react'
import {
    Command as CommandPrimitive,
    CommandEmpty as CommandEmptyPrimitive,
    CommandGroup as CommandGroupPrimitive,
    CommandInput as CommandInputPrimitive,
    CommandItem as CommandItemPrimitive,
    CommandList as CommandListPrimitive,
} from 'cmdk'
import { Search } from 'lucide-react'
import { cn } from '../../lib/utils'

const Command = React.forwardRef(({ className, ...props }, ref) => (
    <CommandPrimitive
        ref={ref}
        className={cn(
            'flex h-full w-full flex-col overflow-hidden rounded-lg bg-white text-slate-950 dark:bg-zinc-950 dark:text-zinc-50',
            className
        )}
        {...props}
    />
))
Command.displayName = 'Command'

const CommandInput = React.forwardRef(({ className, ...props }, ref) => (
    <div className="flex items-center border-b border-slate-100 px-2 dark:border-zinc-800" cmdk-input-wrapper="">
        <Search className="mx-1 h-4 w-4 shrink-0 text-slate-400" aria-hidden />
        <CommandInputPrimitive
            ref={ref}
            className={cn(
                'flex h-10 w-full rounded-md bg-transparent py-2 text-sm outline-none placeholder:text-slate-400 disabled:cursor-not-allowed disabled:opacity-50 dark:placeholder:text-slate-500',
                className
            )}
            {...props}
        />
    </div>
))
CommandInput.displayName = 'CommandInput'

const CommandList = React.forwardRef(({ className, ...props }, ref) => (
    <CommandListPrimitive
        ref={ref}
        className={cn(
            'max-h-[min(360px,50vh)] overflow-y-auto overflow-x-hidden p-1 custom-scrollbar',
            className
        )}
        {...props}
    />
))
CommandList.displayName = 'CommandList'

const CommandEmpty = React.forwardRef(({ className, ...props }, ref) => (
    <CommandEmptyPrimitive
        ref={ref}
        className={cn('py-6 text-center text-sm app-text-meta', className)}
        {...props}
    />
))
CommandEmpty.displayName = 'CommandEmpty'

const CommandGroup = React.forwardRef(({ className, ...props }, ref) => (
    <CommandGroupPrimitive
        ref={ref}
        className={cn(
            'overflow-hidden p-1 text-slate-950 dark:text-slate-100 [&_[cmdk-group-heading]]:px-2 [&_[cmdk-group-heading]]:py-1.5 [&_[cmdk-group-heading]]:text-xs [&_[cmdk-group-heading]]:font-medium [&_[cmdk-group-heading]]:text-slate-500 dark:[&_[cmdk-group-heading]]:text-slate-400',
            className
        )}
        {...props}
    />
))
CommandGroup.displayName = 'CommandGroup'

const CommandItem = React.forwardRef(({ className, ...props }, ref) => (
    <CommandItemPrimitive
        ref={ref}
        className={cn(
            'relative flex cursor-default select-none items-center gap-2 rounded-lg px-2 py-2 text-sm outline-none',
            'data-[selected=true]:bg-slate-50 data-[selected=true]:text-[var(--app-header-bar-bg)] dark:data-[selected=true]:bg-zinc-800 dark:data-[selected=true]:text-zinc-50',
            'aria-disabled:pointer-events-none aria-disabled:opacity-50',
            className
        )}
        {...props}
    />
))
CommandItem.displayName = 'CommandItem'

export { Command, CommandInput, CommandList, CommandEmpty, CommandGroup, CommandItem }
