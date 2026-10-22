/** Import the supplied real media once; subsequent edits/deletions belong to the administrator. */
export function importProvidedProjects(db,catalog){
  db.run('CREATE TABLE IF NOT EXISTS content_imports (name TEXT PRIMARY KEY)');
  const check=db.prepare('SELECT name FROM content_imports WHERE name=?');
  check.bind(['provided-media-2026-10-21']);const exists=check.step();check.free();if(exists)return false;
  db.run('BEGIN');
  try{
    for(const project of catalog){
      db.run('INSERT INTO projects (title,category,description,image,position) VALUES (?,?,?,?,?)',[project.title,project.category,project.description,project.image,project.position]);
      const id=db.exec('SELECT last_insert_rowid() AS id')[0].values[0][0];
      for(const media of project.media)db.run('INSERT INTO project_media (project_id,type,src,thumbnail,alt,position) VALUES (?,?,?,?,?,?)',[id,media.type,media.src,media.thumbnail||'',media.alt,media.position]);
    }
    db.run('INSERT INTO content_imports (name) VALUES (?)',['provided-media-2026-10-21']);db.run('COMMIT');return true;
  }catch(error){db.run('ROLLBACK');throw error}
}
