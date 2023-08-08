const router = require('express').Router();
const mongoose = require('mongoose');
const multer = require('multer');
const { MongoClient } = require('mongodb');
const { GridFSBucket } = require('mongodb');
const path = require('path');
const axios = require("axios")

// Load Mongoose model
const Project = require('../models/Project');

// Multer setup for handling file uploads
const storage = multer.memoryStorage();
const upload = multer({
  storage: storage,
  limits: {
    fileSize: 10 * 1024 * 1024, // Limiting file size to 10 MB (adjust as needed)
  },
});

      
// Upload file route
router.post('/upload', upload.single('projectFile'), async (req, res) => {
  if (!req.isAuthenticated()) {
    return res.status(401).json({ Message: "Unauthorized route" });
  }

  try {
    const { projectName, projectDescription } = req.body;
    const projectFile = req.file;

    if (!projectFile) {
      return res.render("error", { message: 'No project file uploaded.' });
    }

    const project = new Project({
      projectName,
      projectDescription,
    });

    const savedProject = await project.save();

    const database = mongoose.connection.db;
    const bucket = new GridFSBucket(database);
    const uploadStream = bucket.openUploadStream(projectFile.originalname);
    uploadStream.end(projectFile.buffer);

    await Project.findByIdAndUpdate(savedProject._id, { fileId: uploadStream.id });

    res.render("success", { message: 'Project uploaded successfully.', code: true });
  } catch (error) {
    res.status(500).json({ message: 'Internal server error' });
  }
});


// routes for downloading files and fetching project data

router.get('/project', async (req, res) => {
  try {
    const response = await axios.get('http://localhost:3000/projects');
    const projects = response.data;
   
    res.render('project', { projects: projects }); // Pass the projects array to the template
    //res.render('project', { projects: projects }); // Pass the projects array to the template
  } catch (error) {
    console.error(error);
    res.status(500).json({ message: 'Internal server error' });
  }
});


router.get('/download/:id', async (req, res) => {
  try {
    const response = await axios.get(`http://localhost:3000/projects/${req.params.id}`);
    const project = response.data;

    if (project.fileId) {
      const fileResponse = await axios.get(`http://localhost:3000/files/${project.fileId}`, {
        responseType: 'arraybuffer'
      });

      const ext = ".pdf"
      const extension = path.extname(project.projectName);
      const filename = `${project.projectName}${ext}`;

      let contentType = 'application/octet-stream'; // Default MIME type

      // Set the appropriate MIME type based on the file extension
      if (extension === '.pdf') {
        contentType = 'application/pdf';
      } 

      res.setHeader('Content-Disposition', `attachment; filename="${filename}"`);
      res.setHeader('Content-Type', contentType);

      res.send(fileResponse.data);
    } else {
      res.status(404).send('File not found');
    }
  } catch (error) {
    console.error(error);
    res.status(500).json({ message: 'Internal server error' });
  }
});


//  routes for fetching project data and files:
router.get('/projects', async (req, res) => {
  try {
    const projects = await Project.find();
    res.json(projects);
    
  } catch (error) {
    console.error(error);
    res.status(500).json({ message: 'Internal server error' });
  }
});

router.get('/projects/:id', async (req, res) => {
  try {
    const project = await Project.findById(req.params.id);
    res.json(project);
  } catch (error) {
    console.error(error);
    res.status(500).json({ message: 'Internal server error' });
  }
});

router.get('/files/:id', async (req, res) => {
  try {
    const database = mongoose.connection.db;
    const bucket = new GridFSBucket(database);

    const downloadStream = bucket.openDownloadStream(new mongoose.Types.ObjectId(req.params.id));
    downloadStream.pipe(res);
  } catch (error) {
    console.error(error);
    res.status(500).json({ message: 'Internal server error' });
  }
});

// Edit Project route
router.post('/projects/:id', upload.single('projectFile'), async (req, res) => {
  try {
    const { projectName, projectDescription } = req.body;

    if (!projectName || !projectDescription) {
      //return res.status(400).json({ message: 'Project name and description are required.' });
      return res.render("error",{ message: 'Project name and description are required.', id: req.params.id});
    }

    let updatedProject = {
      projectName,
      projectDescription
    };

    if (req.file) {
      // Upload new project file to GridFS
      const database = mongoose.connection.db;
      const bucket = new GridFSBucket(database);
      const uploadStream = bucket.openUploadStream(req.file.originalname);
      uploadStream.end(req.file.buffer);

      // Update the project with the new GridFS file ID
      updatedProject.fileId = uploadStream.id;
    }

    updatedProject = await Project.findByIdAndUpdate(
      req.params.id,
      updatedProject,
      { new: true } // Return the updated project
    );

    if (!updatedProject) {
      //return res.status(404).json({ message: 'Project not found.' });
      return res.render("error",{ message: 'Project not found.',  id: req.params.id });
    }

    //res.status(200).json(updatedProject);
    return res.render("success",{ message: 'Updated Successfully.',  id: req.params.id, code: false});
  } catch (error) {
    res.status(500).json({ message: 'Internal server error' });
  }
});

// Delete Project route
router.delete('/delete/:id', async (req, res) => {
  try {
    const deletedProject = await Project.findByIdAndDelete(req.params.id);

    if (!deletedProject) {
      return res.status(404).json({ message: 'Project not found.' });
    }

    // If the project had a file, delete it from GridFS
    if (deletedProject.fileId) {
      const database = mongoose.connection.db;
      const bucket = new GridFSBucket(database);
      await bucket.delete(deletedProject.fileId);
    }
    res.redirect("/dashboard")
  } catch (error) {
    console.error(error);
    res.status(500).json({ message: 'Internal server error' });
  }
});

// Render edit form for a specific project
router.get('/edit/:id', async (req, res) => {
  try {
    const project = await Project.findById(req.params.id);
    res.render('edit', { project });
  } catch (error) {
    console.error(error);
    res.status(500).json({ message: 'Internal server error' });
  }
});


// Search for a specific project
router.post('/search', async (req, res) => {
  try {
    const { keyword } = req.body;

    if (!keyword) {
      return res.redirect('/project'); // Redirect to projects list if no keyword provided
    }

    const projects = await Project.find({ projectName: { $regex: keyword, $options: 'i' } });

    res.render('search', { projects, keyword });
  } catch (error) {
    console.error(error);
    res.status(500).json({ message: 'Internal server error' });
  }
});

//Admin dashboard route
router.get('/dashboard', async (req, res) => {
  if (!req.isAuthenticated()) {
    return res.redirect("/login");
  }

  try {
    const response = await axios.get('http://localhost:3000/projects');
    const projects = response.data;

    res.render('admin-dashboard', { projects: projects });
  } catch (error) {
    console.error(error);
    res.status(500).json({ message: 'Internal server error' });
  }
});



module.exports = router;