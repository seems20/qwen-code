#!/bin/bash

filename="./hello.thrift"
thrift --gen java:generated_annotations=undated -out maven_project/src/main/java/ $filename
