/** @type {import('@dhis2/cli-app-scripts').D2Config} */
const config = {
    type: 'app',
    name: 'NPD Capture',
    title: 'NPD Capture',
    entryPoints: {
        app: './src/App.jsx',
    },
    direction: 'auto',
    dataStoreNamespace: 'capture-tracker-custom',
    locales: ['en', 'km'],
    icons: {
        16: 'public/dhis2-app-icon-16.png',
        48: 'public/dhis2-app-icon.png',
        128: 'public/dhis2-app-icon-128.png',
    },
    config: {
        indicatorProgramIds: {
            defaultValue: '',
            type: 'string',
            label: 'Program UIDs for indicator management (comma-separated; empty = all tracker programs)',
        },
        dataEntryRoleNames: {
            defaultValue:
                'Data Clerk Role (Tracker Capture),FCA - Tracker data capture,FCA - Capture,Data Clerk,Data Entry,Data entry,NPD Data Entry',
            type: 'string',
            label:
                'Comma-separated DHIS2 user role names for capture lane (records-only)',
        },
    },
}

module.exports = config
