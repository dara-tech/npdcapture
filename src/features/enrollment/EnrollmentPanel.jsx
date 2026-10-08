import React, { useEffect, useState } from 'react'
import { useDataEngine } from '@dhis2/app-runtime'
import { createEnrollment, fetchProgramMetadata } from '../../services/trackerApi'
import { normalizeProgramMetadata } from '../../services/metadataService'
import { Card, CardContent, CardHeader, CardTitle } from '../../components/ui/card'
import { Select } from '../../components/ui/select'
import { Button } from '../../components/ui/button'
import { Alert } from '../../components/ui/alert'
import { Spinner } from '../../components/ui/spinner'

export const EnrollmentPanel = ({
    context,
    selectedTei,
    selectedEnrollment,
    selectedStage,
    onSelectEnrollment,
    onSelectStage,
}) => {
    const engine = useDataEngine()
    const [metadata, setMetadata] = useState(null)
    const [loading, setLoading] = useState(false)
    const [error, setError] = useState('')

    useEffect(() => {
        const run = async () => {
            if (!context.program) {
                setMetadata(null)
                return
            }
            try {
                const program = await fetchProgramMetadata({ engine, programId: context.program })
                setMetadata(normalizeProgramMetadata(program))
            } catch (e) {
                setError(e.message || 'Failed to load program metadata')
            }
        }
        run()
    }, [context.program, engine])

    const enrollSelectedTei = async () => {
        if (!selectedTei) {
            return
        }
        try {
            setLoading(true)
            setError('')
            await createEnrollment({
                engine,
                teiId: selectedTei.trackedEntity,
                orgUnit: context.orgUnit,
                program: context.program,
            })
        } catch (e) {
            setError(e.message || 'Enrollment failed')
        } finally {
            setLoading(false)
        }
    }

    const enrollments = (selectedTei?.enrollments || []).filter((enr) => enr.program === context.program)

    return (
        <Card>
            <CardHeader>
                <CardTitle>Enrollment and stage</CardTitle>
            </CardHeader>
            <CardContent className="flex flex-col gap-3">
                {!selectedTei ? <Alert title="Select tracked entity">Choose a tracked entity from search first.</Alert> : null}
                {error ? <Alert variant="destructive" title="Enrollment error">{error}</Alert> : null}
                <Button variant="primary" onClick={enrollSelectedTei} disabled={!selectedTei || loading}>
                    Enroll selected TEI
                </Button>
                {loading ? <Spinner /> : null}

                <label className="flex flex-col gap-1.5">
                    <span className="text-xs font-semibold text-slate-700">Enrollment</span>
                    <Select
                        value={selectedEnrollment?.enrollment || ''}
                        onValueChange={(value) => {
                            const picked = enrollments.find((enr) => enr.enrollment === value) || null
                            onSelectEnrollment(picked)
                        }}
                        placeholder="Select enrollment"
                        options={enrollments.map((enrollment) => ({
                            value: enrollment.enrollment,
                            label: `${enrollment.enrollment} (${enrollment.status})`,
                        }))}
                    />
                </label>

                <label className="flex flex-col gap-1.5">
                    <span className="text-xs font-semibold text-slate-700">Program Stage</span>
                    <Select
                        value={selectedStage?.id || ''}
                        onValueChange={(value) => {
                            const picked = metadata?.stages.find((stage) => stage.id === value) || null
                            onSelectStage(picked)
                        }}
                        placeholder="Select stage"
                        options={(metadata?.stages || []).map((stage) => ({
                            value: stage.id,
                            label: stage.name,
                        }))}
                    />
                </label>
            </CardContent>
        </Card>
    )
}
