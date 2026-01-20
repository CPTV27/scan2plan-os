
const BASE_URL = 'http://localhost:5000/api';

async function testPipeline() {
    console.log('🚀 Starting Sales Pipeline Test...');

    try {
        // 1. Create a Lead
        console.log('\nStep 1: Creating a Lead...');
        const leadResponse = await fetch(`${BASE_URL}/leads`, {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({
                clientName: 'Acme Test Corp',
                projectName: 'Test Project 2026',
                projectAddress: '123 Test St, Troy, NY 12180',
                value: 15000,
                probability: 50,
                dealStage: 'Leads',
                source: 'cold_outreach',
                cpqAreas: [],
                cpqRisks: [],
                missingInfo: [],
                projectStatus: {},
                discipline: 'Architecture',
                buildingType: 'Commercial / Office',
                firmSize: '1-10',
                abmTier: 'None'
            })
        });

        if (!leadResponse.ok) {
            const err = await leadResponse.json();
            throw new Error(`Failed to create lead: ${JSON.stringify(err)}`);
        }
        const lead = await leadResponse.json();
        console.log('✅ Lead created:', { id: lead.id, clientName: lead.clientName });

        // 2. Move to Proposal (Generates Project Code)
        console.log('\nStep 2: Moving Lead to Proposal Stage...');
        const proposalResponse = await fetch(`${BASE_URL}/leads/${lead.id}`, {
            method: 'PUT',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({
                ...lead,
                dealStage: 'Proposal'
            })
        });

        if (!proposalResponse.ok) {
            const err = await proposalResponse.text();
            throw new Error(`Failed to update to Proposal: ${err}`);
        }
        const updatedLead = await proposalResponse.json();
        console.log('✅ Lead updated to Proposal. Project Code:', updatedLead.projectCode);

        // 3. Move to Closed Won (Triggers Project Creation)
        console.log('\nStep 3: Moving Lead to Closed Won...');
        const wonResponse = await fetch(`${BASE_URL}/leads/${lead.id}`, {
            method: 'PUT',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({
                ...updatedLead,
                dealStage: 'Closed Won'
            })
        });

        if (!wonResponse.ok) {
            const err = await wonResponse.text();
            throw new Error(`Failed to update to Closed Won: ${err}`);
        }
        console.log('✅ Lead updated to Closed Won.');

        // 4. Verify Project Creation
        console.log('\nStep 4: Verifying Project Creation...');
        const projectsResponse = await fetch(`${BASE_URL}/projects`);
        const projects = await projectsResponse.json();
        const newProject = projects.find((p: any) => p.leadId === lead.id);

        if (newProject) {
            console.log('✅ Project automatically created:', {
                id: newProject.id,
                name: newProject.name,
                universalProjectId: newProject.universalProjectId,
                status: newProject.status
            });
        } else {
            throw new Error('❌ Project was not created for the won lead.');
        }

        // 5. Check Financials (using the new stub)
        console.log('\nStep 5: Checking Project Financials...');
        const financialsResponse = await fetch(`${BASE_URL}/projects/${newProject.id}/financials`);
        if (!financialsResponse.ok) {
            const err = await financialsResponse.text();
            throw new Error(`Failed to fetch financials: ${err}`);
        }
        const financials = await financialsResponse.json();
        console.log('✅ Financials retrieved:', financials);

        console.log('\n🎉 Sales Pipeline Test PASSED!');
    } catch (error) {
        console.error('\n❌ Test FAILED:', error.message);
        process.exit(1);
    }
}

testPipeline();
