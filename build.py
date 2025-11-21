#!/usr/bin/env python3
"""
RDMind 项目构建脚本
一键完成本地安装和构建

使用方法:
    ./build.py

功能:
    1. 检查环境依赖（Python、Node.js、npm）
    2. 智能清理构建产物（根据情况自动选择）
    3. 安装依赖（使用 npm install）
    4. 构建项目（npm run build）
    5. 智能链接 rdmind 命令到全局（自动检测是否需要 sudo）

系统要求:
    - Python 3.6+
    - Node.js 20+（项目要求）
    - npm 8+
"""

import os
import sys
import subprocess
import shutil
import glob
import platform
import pwd


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


def run_command(command, description, capture_output=False):
    """运行命令并处理输出"""
    print(f"执行: {command}")
    try:
        result = subprocess.run(
            command,
            shell=True,
            check=True,
            capture_output=capture_output,
            text=True
        )
        print_success(f"{description} 完成")
        return True
    except subprocess.CalledProcessError as e:
        print_error(f"{description} 失败，错误代码: {e.returncode}")
        if e.stderr:
            print_error(f"错误信息: {e.stderr}")
        return False
    except FileNotFoundError:
        print_error(f"命令未找到: {command}")
        print_error("请确保相关工具已正确安装并添加到 PATH")
        return False


def check_environment():
    """检查运行环境"""
    print_step(0, "检查运行环境")
    
    # 检查操作系统
    system = platform.system()
    if system != 'Darwin':
        print_warning(f"检测到操作系统: {system}")
        print_warning("此脚本主要针对 macOS 设计，其他系统可能存在问题")
    
    # 检查 Python 版本
    python_version = sys.version_info
    if python_version.major < 3 or (python_version.major == 3 and python_version.minor < 6):
        print_error(f"Python 版本过低: {python_version.major}.{python_version.minor}")
        print_error("需要 Python 3.6 或更高版本")
        return False
    print_success(f"Python 版本: {python_version.major}.{python_version.minor}.{python_version.micro}")
    
    # 检查 Node.js（项目要求 Node.js 20+）
    try:
        result = subprocess.run(
            ["node", "--version"],
            capture_output=True,
            text=True,
            check=True
        )
        node_version_str = result.stdout.strip()
        # 提取版本号（去掉 v 前缀）
        version_parts = node_version_str.lstrip('v').split('.')
        node_major = int(version_parts[0])
        if node_major < 20:
            print_error(f"Node.js 版本过低: {node_version_str}")
            print_error("项目要求 Node.js 20 或更高版本: https://nodejs.org/")
            return False
        print_success(f"Node.js 版本: {node_version_str}")
    except (FileNotFoundError, subprocess.CalledProcessError):
        print_error("Node.js 未安装或未找到")
        print_error("请安装 Node.js 20 或更高版本: https://nodejs.org/")
        return False
    
    # 检查 npm
    try:
        result = subprocess.run(
            ["npm", "--version"],
            capture_output=True,
            text=True,
            check=True
        )
        npm_version = result.stdout.strip()
        npm_major = int(npm_version.split('.')[0])
        if npm_major < 8:
            print_warning(f"npm 版本较低: {npm_version}，建议升级到 8+")
        else:
            print_success(f"npm 版本: {npm_version}")
    except (FileNotFoundError, subprocess.CalledProcessError):
        print_error("npm 未安装或未找到")
        print_error("npm 通常随 Node.js 一起安装")
        return False
    
    return True


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


def fix_dist_permissions():
    """修复 dist 目录的权限问题
    
    检查 dist 目录及其文件的所有者，如果是 root 则尝试修复为当前用户
    """
    dist_path = "dist"
    if not os.path.exists(dist_path):
        return True
    
    try:
        # 获取当前用户名
        current_user = pwd.getpwuid(os.getuid()).pw_name
        
        # 检查 dist 目录的所有者
        dist_stat = os.stat(dist_path)
        dist_owner = pwd.getpwuid(dist_stat.st_uid).pw_name
        
        # 如果所有者不是当前用户，尝试修复
        if dist_owner != current_user:
            print_warning(f"检测到 dist 目录权限问题（所有者: {dist_owner}）")
            print(f"正在修复 dist 目录权限为当前用户: {current_user}...")
            
            # 尝试使用 chown 修复权限
            chown_cmd = f"sudo chown -R {current_user} {dist_path}"
            print(f"执行: {chown_cmd}")
            print("提示: 需要输入管理员密码")
            
            result = subprocess.run(
                chown_cmd,
                shell=True,
                check=False,
                capture_output=True,
                text=True
            )
            
            if result.returncode == 0:
                print_success(f"dist 目录权限已修复为 {current_user}")
                return True
            else:
                print_error(f"权限修复失败: {result.stderr}")
                print_warning("请手动运行以下命令修复权限:")
                print_warning(f"  sudo chown -R {current_user} {dist_path}")
                return False
        else:
            # 检查 dist 目录内的文件权限
            has_permission_issue = False
            for root, dirs, files in os.walk(dist_path):
                for item in dirs + files:
                    item_path = os.path.join(root, item)
                    try:
                        item_stat = os.stat(item_path)
                        item_owner = pwd.getpwuid(item_stat.st_uid).pw_name
                        if item_owner != current_user:
                            has_permission_issue = True
                            break
                    except (OSError, KeyError):
                        continue
                if has_permission_issue:
                    break
            
            if has_permission_issue:
                print_warning("检测到 dist 目录内文件权限问题")
                chown_cmd = f"sudo chown -R {current_user} {dist_path}"
                print(f"执行: {chown_cmd}")
                print("提示: 需要输入管理员密码")
                
                result = subprocess.run(
                    chown_cmd,
                    shell=True,
                    check=False,
                    capture_output=True,
                    text=True
                )
                
                if result.returncode == 0:
                    print_success(f"dist 目录权限已修复为 {current_user}")
                    return True
                else:
                    print_error(f"权限修复失败: {result.stderr}")
                    print_warning("请手动运行以下命令修复权限:")
                    print_warning(f"  sudo chown -R {current_user} {dist_path}")
                    return False
        
        return True
    except (OSError, KeyError, AttributeError) as e:
        # Windows 系统或其他不支持 pwd 的系统
        if platform.system() == 'Windows':
            return True  # Windows 不需要处理权限问题
        print_warning(f"权限检查时出现异常: {e}")
        return True  # 继续执行，不阻塞构建流程


def clean_bundle_directory():
    """删除 bundle 目录"""
    if os.path.exists("bundle"):
        print("删除 bundle 目录...")
        shutil.rmtree("bundle")
        print_success("bundle 目录已删除")
        return True
    return True


def clean_build_artifacts(use_npm_clean=True):
    """清理构建产物"""
    if use_npm_clean:
        print_step(1, "清理构建产物（使用 npm run clean）")
        return run_command("npm run clean", "清理构建产物")
    else:
        print_step(1, "清理构建产物（手动清理）")
        
        # 删除 bundle 目录
        if os.path.exists("bundle"):
            print("删除目录: bundle")
            shutil.rmtree("bundle")
        
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
    """安装依赖（使用 npm install）"""
    print_step(3, "安装依赖")
    return run_command("npm install", "依赖安装")


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


def link_command(use_sudo=True):
    """链接 rdmind 命令到全局
    
    默认使用 sudo，如果失败则尝试普通权限（适用于已配置 npm 全局目录权限的情况）
    """
    print_step(6, "链接 rdmind 命令")
    
    # 先尝试取消现有的链接（如果存在）
    print("移除现有链接...")
    unlink_cmd = "npm unlink -g @rdmind/rdmind 2>/dev/null || true"
    if use_sudo:
        unlink_cmd = f"sudo {unlink_cmd}"
    subprocess.run(unlink_cmd, shell=True, check=False)
    
    # 尝试链接（默认使用 sudo，因为大多数用户需要）
    link_cmd = "npm link --force"
    if use_sudo:
        link_cmd = f"sudo {link_cmd}"
        print("提示: 使用 sudo 权限链接，可能需要输入密码")
    
    success = run_command(link_cmd, "命令链接")
    
    if not success:
        if use_sudo:
            # 如果 sudo 失败，尝试普通权限（适用于已配置 npm 全局目录权限的用户）
            print_warning("sudo 权限链接失败，尝试使用普通权限...")
            return link_command(use_sudo=False)
        else:
            print_warning("npm link 失败，请检查权限设置")
            print_warning("您可以稍后手动运行: sudo npm link --force")
            print_warning("或者检查 npm 全局目录权限")
            return False
    
    return success


def is_first_install():
    """判断是否是首次安装（没有 node_modules）"""
    return not os.path.exists("node_modules")


def main():
    """主函数"""
    print("=" * 60)
    print("           RDMind 项目构建脚本")
    print("=" * 60)
    
    # 检查运行环境
    if not check_environment():
        print_error("环境检查失败，请解决上述问题后重试")
        sys.exit(1)
    
    # 检查项目结构
    if not check_project_structure():
        sys.exit(1)
    
    # 判断是否是首次安装
    first_install = is_first_install()
    
    # 在清理之前，先修复 dist 目录的权限问题（如果存在）
    # 这可以避免在清理或安装时遇到权限错误
    if os.path.exists("dist"):
        print("\n🔧 检查 dist 目录权限")
        fix_dist_permissions()
    
    # 根据情况选择清理策略
    if first_install:
        # 首次安装：不需要清理（但为了保险，检查一下 bundle 目录）
        print("\n🔧 首次安装模式")
        # 即使首次安装，如果存在 bundle 目录也清理一下（可能之前有残留）
        if os.path.exists("bundle"):
            print("检测到 bundle 目录，清理中...")
            clean_bundle_directory()
    else:
        # 更新模式：严格按照流程 - 删除 bundle 目录，然后执行 npm run clean
        print("\n🔧 更新模式：清理构建产物")
        clean_bundle_directory()
        if not run_command("npm run clean", "清理构建产物"):
            print_warning("npm run clean 失败，尝试手动清理...")
            clean_build_artifacts(use_npm_clean=False)
    
    # 安装依赖
    if not install_dependencies():
        print_error("依赖安装失败，构建过程终止")
        sys.exit(1)
    
    # 构建项目
    if not build_project():
        print_error("项目构建失败，构建过程终止")
        sys.exit(1)
    
    # 验证构建结果
    if not verify_build():
        print_warning("部分构建产物缺失，但继续执行...")
    
    # 链接命令（自动检测是否需要 sudo）
    link_command()
    
    print("\n" + "=" * 60)
    print("           构建完成！")
    print("=" * 60)
    
    print("\n使用方法:")
    print("  - 运行 rdmind 命令: rdmind")
    
    print("\n📝 提示:")
    print("  - 代码更新后，直接运行 ./build.py 即可重新构建")
    print("\n💡 开发时快速体验:")
    print("  - 修改代码后，执行: sudo npm run bundle")
    print("  - 然后就可以直接使用 rdmind 命令测试新效果")


if __name__ == "__main__":
    main()