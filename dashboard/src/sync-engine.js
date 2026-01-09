const chokidar = require('chokidar');
const fs = require('fs');
const path = require('path');
const { createClient } = require('@supabase/supabase-js');

// Initialize Supabase client
const supabaseUrl = process.env.SUPABASE_URL;
const supabaseAnonKey = process.env.SUPABASE_ANON_KEY;
const supabase = createClient(supabaseUrl, supabaseAnonKey);

// Define paths
const completedPath = path.join(__dirname, '../tasks/completed');
const archivedPath = path.join(__dirname, '../tasks/archived');

// Ensure directories exist
[completedPath, archivedPath].forEach(dir => {
  if (!fs.existsSync(dir)) {
    fs.mkdirSync(dir, { recursive: true });
  }
});

// Watch the completed folder
const watcher = chokidar.watch(completedPath, {
  persistent: true,
  ignoreInitial: true,
  awaitWriteFinish: {
    stabilityThreshold: 2000,
    pollInterval: 100,
  },
});

watcher
  .on('add', async (filePath) => {
    if (path.extname(filePath) === '.json') {
      console.log(`New file detected: ${filePath}`);
      
      try {
        // Read the JSON file
        const data = JSON.parse(fs.readFileSync(filePath, 'utf-8'));
        
        // Insert into decision_logs table
        const { error } = await supabase
          .from('decision_logs')
          .insert([{
            task_id: data.task_id || null,
            role: data.role || null,
            decision: data.decision || null,
            financial_impact: data.financial_impact || null,
            rationale: data.rationale || null,
            timestamp: new Date().toISOString(),
          }]);
        
        if (error) {
          console.error(`Error inserting data: ${error.message}`);
          return;
        }
        
        console.log(`Data inserted for: ${path.basename(filePath)}`);
        
        // Move file to archived folder
        const fileName = path.basename(filePath);
        const archivedFilePath = path.join(archivedPath, fileName);
        fs.renameSync(filePath, archivedFilePath);
        console.log(`File archived: ${archivedFilePath}`);
        
      } catch (err) {
        console.error(`Error processing file ${filePath}: ${err.message}`);
      }
    }
  })
  .on('error', (error) => console.error(`Watcher error: ${error}`));

console.log(`Sync engine started. Watching: ${completedPath}`);
