
const { createClient } = require('@supabase/supabase-js');

const SUPABASE_URL = 'https://ewlvfgfvxauxqfruyfoz.supabase.co';
const SUPABASE_ANON_KEY = 'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6ImV3bHZmZ2Z2eGF1eHFmcnV5Zm96Iiwicm9sZSI6ImFub24iLCJpYXQiOjE3NjY5MzE5ODcsImV4cCI6MjA4MjUwNzk4N30.ooyzf97JuKwweZ3m2YHmT9fXYyJo0hUuc6vsOSNTBtM';

const supabase = createClient(SUPABASE_URL, SUPABASE_ANON_KEY);

async function checkDuplicates() {
    const { data, error } = await supabase
        .from('teacher_assignments')
        .select('*');

    if (error) {
        console.error(error);
        return;
    }

    const dateMap = {};
    const toDelete = [];

    data.forEach(row => {
        if (!dateMap[row.activity_date]) {
            dateMap[row.activity_date] = row;
        } else {
            // Logic to decide which one to keep
            // Keep the one with more text info
            const currentKeep = dateMap[row.activity_date];
            const currentScore = (currentKeep.age_group_3_6?.length || 0) + (currentKeep.age_group_7_9?.length || 0);
            const rowScore = (row.age_group_3_6?.length || 0) + (row.age_group_7_9?.length || 0);

            if (rowScore > currentScore) {
                toDelete.push(currentKeep.id);
                dateMap[row.activity_date] = row;
            } else {
                toDelete.push(row.id);
            }
        }
    });

    console.log(`Found ${toDelete.length} duplicates to delete.`);
    if (toDelete.length > 0) {
        const { error: delError } = await supabase
            .from('teacher_assignments')
            .delete()
            .in('id', toDelete);

        if (delError) console.error(delError);
        else console.log(`Deleted ${toDelete.length} duplicate entries.`);
    }
}

checkDuplicates();
