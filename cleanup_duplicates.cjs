
const { createClient } = require('@supabase/supabase-js');

const SUPABASE_URL = 'https://ewlvfgfvxauxqfruyfoz.supabase.co';
const SUPABASE_ANON_KEY = 'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6ImV3bHZmZ2Z2eGF1eHFmcnV5Zm96Iiwicm9sZSI6ImFub24iLCJpYXQiOjE3NjY5MzE5ODcsImV4cCI6MjA4MjUwNzk4N30.ooyzf97JuKwweZ3m2YHmT9fXYyJo0hUuc6vsOSNTBtM';

const supabase = createClient(SUPABASE_URL, SUPABASE_ANON_KEY);

async function cleanup() {
    console.log("Fetching duplicates...");
    const { data, error } = await supabase
        .from('teacher_assignments')
        .select('*')
        .eq('activity_date', '2026-02-08');

    if (error) {
        console.error("Error fetching data:", error);
        return;
    }

    console.log(`Found ${data.length} entries for 2026-02-08`);

    // We want to delete entries where age_group_3_6 is '1'
    const toDelete = data.filter(row => row.age_group_3_6 === '1');
    console.log(`Found ${toDelete.length} entries to delete.`);

    for (const row of toDelete) {
        console.log(`Deleting ID: ${row.id}`);
        const { error: delError } = await supabase
            .from('teacher_assignments')
            .delete()
            .eq('id', row.id);

        if (delError) {
            console.error(`Error deleting ${row.id}:`, delError);
        } else {
            console.log(`Successfully deleted ${row.id}`);
        }
    }
}

cleanup();
