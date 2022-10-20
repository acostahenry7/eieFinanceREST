#!/bin/bash

ROOTPATH=/home/junior/Documents/proyectos/eieFinanceREST

echo -e 
echo "USAGE: Starts the http server for EIEFinanceREST"
echo -e
while getopts 'dh ' c
do
	case $c in 
	  d) nodemon $ROOTPATH/src/index.js & > /dev/null ;;
	  dl) nodemon ../src/index.js;;
	  l) node ../src/index.js;;
          h) 
             echo "	Option  Description"
             echo ""
	     echo "	-d      Starts the server in dev mode"
	     echo "	-dl     Starts the server in dev mode and logs the output in runtime"
	     echo "	-l      Starts the Server in producton mode and logs the output in runtime"
	     echo "	-h      Displays the help"
	     echo "" 
	     echo "	Examples:"
	     echo ""
	     echo "	./start_server.sh -d"
	     echo "";;
	esac
done
if [ $OPTIND -eq 1 ]; 
then 
       	node ../src/index.js &
fi

echo -e ""

#getopts d flag

#if [ "$flag" == "d" ]; then
#	nodemon ../src/index.js
#elif ["$flag" == "h" ];then
#	echo ""
#	echo "-d	Starts the server in dev mode."
#else
#	node ../src/index.js	
#fi 
