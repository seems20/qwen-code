#!/bin/bash

# 这里每一行就是一个thrift文件路径,直接遍历来快速构建
filename="./service.thrift"
for file in $filename; do
    thrift --gen java:generated_annotations=undated -out maven_project/src/main/java/ $file
done
