#!/bin/bash


root_dir="./src"
sh_script="/home/henry/Documents/proyectos/default-templates/handlebar-project"

mkdir -p $root_dir/controllers \
	 $root_dir/public\
	 $root_dir/public/css\
	 $root_dir/public/js\
	 $root_dir/public/media\
	 $root_dir/routes\
	 $root_dir/server\
	 $root_dir/views\
	 $root_dir/views/layouts\
	 $root_dir/views/partials\

	
	cp $sh_script/package.json $root_dir/../
	cp $sh_script/index.js $root_dir/index.js
	cp $sh_script/server/config.js $root_dir/server
	cp $sh_script/routes/index.js $root_dir/routes

	npm install
	npm run test
