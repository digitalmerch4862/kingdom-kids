
const { createClient } = require('@supabase/supabase-js');

const SUPABASE_URL = 'https://ewlvfgfvxauxqfruyfoz.supabase.co';
const SUPABASE_ANON_KEY = 'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6ImV3bHZmZ2Z2eGF1eHFmcnV5Zm96Iiwicm9sZSI6ImFub24iLCJpYXQiOjE3NjY5MzE5ODcsImV4cCI6MjA4MjUwNzk4N30.ooyzf97JuKwweZ3m2YHmT9fXYyJo0hUuc6vsOSNTBtM';

const supabase = createClient(SUPABASE_URL, SUPABASE_ANON_KEY);

async function findOne() {
    const { data, error } = await supabase
        .from('teacher_assignments')
        .select('*')
        .eq('age_group_3_6', '1');

    if (error) {
        console.error("Error fetching data:", error);
        return;
    }

    console.log(`Found ${data.length} entries with '1'`);
    data.forEach(row => {
        console.log(`ID: ${row.id} | Date: ${row.activity_date}`);
    });

    if (data.length > 0) {
        const ids = data.map(r => r.id);
        const { error: delError } = await supabase
            .from('teacher_assignments')
            .delete()
            .in('id', ids);

        if (delError) console.error("Del error:", delError);
        else console.log(`Deleted ${ids.length} entries.`);
    }
}

findOne();
