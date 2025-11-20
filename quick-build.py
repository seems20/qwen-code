#!/usr/bin/env python3
"""
RDMind 快速构建脚本
轻量级版本，快速清理、编译和全局安装

使用方法:
    ./quick-build.py

功能:
    1. 清理构建产物（packages/core/dist、packages/cli/dist、dist）
    2. 构建项目（npm run build）
    3. 全局安装（sudo npm install -g .）
"""

import os
import sys
import subprocess
import shutil


def print_step(step_num, description):
    """打印步骤信息"""
    print(f"\n🔧 步骤 {step_num}: {description}")


def print_success(message):
    """打印成功信息"""
    print(f"✅ {message}")


def print_error(message):
    """打印错误信息"""
    print(f"❌ {message}")
    sys.exit(1)


def run_command(cmd, description, use_sudo=False, check=True):
    """执行命令"""
    if use_sudo:
        cmd = ['sudo'] + cmd
    
    print(f"   → 执行: {' '.join(cmd)}")
    
    try:
        result = subprocess.run(
            cmd,
            check=check,
            capture_output=False,
            text=True
        )
        return result.returncode == 0
    except subprocess.CalledProcessError as e:
        if check:
            print_error(f"命令执行失败: {e}")
        return False
    except FileNotFoundError:
        print_error(f"命令不存在: {cmd[0]}")
        return False


def clean_dist():
    """清理构建产物"""
    print_step(1, "清理构建产物")
    
    dirs_to_clean = [
        'packages/core/dist',
        'packages/cli/dist',
        'dist'
    ]
    
    for dir_path in dirs_to_clean:
        if os.path.exists(dir_path):
            print(f"   → 删除: {dir_path}")
            try:
                shutil.rmtree(dir_path)
            except PermissionError:
                # 如果权限不足，使用 sudo
                run_command(['rm', '-rf', dir_path], f"删除 {dir_path}", use_sudo=True)
        else:
            print(f"   → 跳过: {dir_path} (不存在)")
    
    print_success("构建产物清理完成")


def build_project():
    """构建项目"""
    print_step(2, "构建项目")
    
    if not run_command(['npm', 'run', 'build'], "构建项目"):
        print_error("构建失败")
    
    print_success("项目构建完成")


def install_globally():
    """全局安装"""
    print_step(3, "全局安装")
    
    if not run_command(['npm', 'install', '-g', '.'], "全局安装", use_sudo=True):
        print_error("全局安装失败")
    
    print_success("全局安装完成")


def main():
    """主函数"""
    print("=" * 60)
    print("  RDMind 快速构建脚本")
    print("=" * 60)
    
    # 检查是否在项目根目录
    if not os.path.exists('package.json'):
        print_error("请在项目根目录下运行此脚本")
    
    try:
        # 1. 清理
        clean_dist()
        
        # 2. 构建
        build_project()
        
        # 3. 安装
        install_globally()
        
        print("\n" + "=" * 60)
        print("✅ 全部完成！")
        print("=" * 60)
        print("\n现在可以运行: rdmind")
        
    except KeyboardInterrupt:
        print("\n\n⚠️  构建被用户中断")
        sys.exit(1)
    except Exception as e:
        print_error(f"发生错误: {e}")


if __name__ == '__main__':
    main()

