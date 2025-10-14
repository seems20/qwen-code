#!/usr/bin/env python3
"""
RDMind 项目构建脚本
解决 TypeScript 编译错误和构建问题

使用方法:
    python3 build.py

功能:
    1. 彻底清理构建产物
    2. 清理 npm 缓存
    3. 重新安装依赖
    4. 重新构建项目
"""

import os
import sys
import subprocess
import shutil
import glob


def print_step(step_num, description):
    """打印步骤信息"""
    print(f"\n🔧 步骤 {step_num}: {description}")


def print_success(message):
    """打印成功信息"""
    print(f"✅ {message}")


def print_error(message):
    """打印错误信息"""
    print(f"❌ {message}")


def print_warning(message):
    """打印警告信息"""
    print(f"⚠️  {message}")


def run_command(command, description):
    """运行命令并处理输出"""
    print(f"执行: {command}")
    try:
        result = subprocess.run(command, shell=True, check=True)
        print_success(f"{description} 完成")
        return True
    except subprocess.CalledProcessError as e:
        print_error(f"{description} 失败，错误代码: {e.returncode}")
        return False


def check_project_structure():
    """检查项目结构是否正确"""
    required_files = [
        "package.json",
        "packages/core/package.json",
        "packages/cli/package.json"
    ]
    
    for file_path in required_files:
        if not os.path.exists(file_path):
            print_error(f"项目结构不正确，缺少文件: {file_path}")
            print_error("请确保在项目根目录下运行此脚本")
            return False
    
    print_success("项目结构检查通过")
    return True


def clean_build_artifacts():
    """清理构建产物"""
    print_step(1, "清理构建产物")
    
    # 删除所有 packages/*/dist 目录
    dist_dirs = glob.glob("packages/*/dist")
    for dist_dir in dist_dirs:
        if os.path.exists(dist_dir):
            print(f"删除目录: {dist_dir}")
            shutil.rmtree(dist_dir)
    
    # 删除根目录的 dist 目录（如果存在）
    if os.path.exists("dist"):
        print("删除目录: dist")
        shutil.rmtree("dist")
    
    print_success("构建产物清理完成")
    return True


def clean_npm_cache():
    """清理 npm 缓存"""
    print_step(2, "清理 npm 缓存")
    return run_command("npm cache clean --force", "npm 缓存清理")


def install_dependencies():
    """重新安装依赖"""
    print_step(3, "重新安装依赖")
    return run_command("npm ci", "依赖安装")


def build_project():
    """构建项目"""
    print_step(4, "构建项目")
    return run_command("npm run build", "项目构建")


def verify_build():
    """验证构建结果"""
    print_step(5, "验证构建结果")
    
    # 检查关键构建产物
    key_files = [
        "bundle/gemini.js",
        "packages/core/dist/index.js",
        "packages/cli/dist/index.js"
    ]
    
    all_exist = True
    for file_path in key_files:
        if os.path.exists(file_path):
            print_success(f"构建产物存在: {file_path}")
        else:
            print_error(f"构建产物缺失: {file_path}")
            all_exist = False
    
    return all_exist


def main():
    """主函数"""
    print("=" * 60)
    print("           RDMind 项目构建脚本")
    print("=" * 60)
    
    # 检查项目结构
    if not check_project_structure():
        sys.exit(1)
    
    # 执行构建步骤
    steps = [
        ("清理构建产物", clean_build_artifacts),
        ("清理 npm 缓存", clean_npm_cache),
        ("重新安装依赖", install_dependencies),
        ("构建项目", build_project),
        ("验证构建结果", verify_build)
    ]
    
    for step_name, step_func in steps:
        if not step_func():
            if step_name in ["清理 npm 缓存"]:
                print_warning(f"{step_name} 失败，继续执行后续步骤")
                continue
            else:
                print_error(f"{step_name} 失败，构建过程终止")
                sys.exit(1)
    
    print("\n" + "=" * 60)
    print("           构建完成！")
    print("=" * 60)
    
    print("\n构建产物位置:")
    print("  - 主程序: bundle/gemini.js")
    print("  - Core 包: packages/core/dist/")
    print("  - CLI 包: packages/cli/dist/")
    print("  - VSCode 扩展: packages/vscode-ide-companion/dist/")
    
    print("\n使用方法:")
    print("  - 运行项目: npm run start")
    print("  - 运行测试: npm run test")
    print("  - 代码检查: npm run lint")


if __name__ == "__main__":
    main()