
const { createClient } = require('@supabase/supabase-js');

const SUPABASE_URL = 'https://ewlvfgfvxauxqfruyfoz.supabase.co';
const SUPABASE_ANON_KEY = 'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6ImV3bHZmZ2Z2eGF1eHFmcnV5Zm96Iiwicm9sZSI6ImFub24iLCJpYXQiOjE3NjY5MzE5ODcsImV4cCI6MjA4MjUwNzk4N30.ooyzf97JuKwweZ3m2YHmT9fXYyJo0hUuc6vsOSNTBtM';

const supabase = createClient(SUPABASE_URL, SUPABASE_ANON_KEY);

async function check() {
    const { data, error } = await supabase
        .from('teacher_assignments')
        .select('*')
        .order('activity_date');

    if (error) {
        console.error("Error fetching data:", error);
        return;
    }

    data.forEach(row => {
        console.log(`${row.activity_date} | ${row.age_group_3_6} | ${row.id}`);
    });
}

check();
