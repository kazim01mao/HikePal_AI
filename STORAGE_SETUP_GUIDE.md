# Supabase Storage 存储桶权限设置指南

由于Supabase的`storage.objects`表是系统管理的，不能直接通过SQL修改权限，需要通过Supabase Dashboard UI来设置。

## 步骤1：访问Supabase Dashboard

1. 打开 [Supabase Dashboard](https://supabase.com/dashboard/project/ojcvrvutsylptamslntq/storage)
2. 登录你的账户

## 步骤2：检查存储桶是否存在

1. 在左侧菜单点击 **Storage**
2. 你应该能看到 `emotion-images` 存储桶（已经通过Python脚本创建）
3. 如果不存在，点击 **Create a new bucket**：
   - 名称: `emotion-images`
   - 设置为 **Public**
   - 文件大小限制: 5MB (5242880 bytes)

## 步骤3：设置存储桶策略（Policies）

1. 点击 `emotion-images` 存储桶
2. 点击 **Policies** 标签页
3. 点击 **Create policy** 或 **New policy**

### 策略1：公共读取权限（Public Read Access）

1. 点击 **Create policy**
2. 选择 **For full customization**
3. 配置：
   - **Policy name**: `Public Read Access`
   - **Allowed operations**: `SELECT`
   - **Policy definition**: 使用以下SQL：
     ```sql
     (bucket_id = 'emotion-images')
     ```
   - **Policy applies to**: `ALL users`
4. 点击 **Review**
5. 点击 **Save policy**

### 策略2：认证用户上传权限（Authenticated Upload）

1. 点击 **Create policy**
2. 选择 **For full customization**
3. 配置：
   - **Policy name**: `Authenticated Upload`
   - **Allowed operations**: `INSERT`
   - **Policy definition**: 使用以下SQL：
     ```sql
     (bucket_id = 'emotion-images' AND auth.role() = 'authenticated')
     ```
   - **Policy applies to**: `Authenticated users only`
4. 点击 **Review**
5. 点击 **Save policy**

### 策略3：用户更新自己的文件（Optional）

1. 点击 **Create policy**
2. 选择 **For full customization**
3. 配置：
   - **Policy name**: `User Update Own Files`
   - **Allowed operations**: `UPDATE`
   - **Policy definition**: 使用以下SQL：
     ```sql
     (
       bucket_id = 'emotion-images' 
       AND auth.role() = 'authenticated'
       AND (storage.foldername(name))[1] = auth.uid()::text
     )
     ```
   - **Policy applies to**: `Authenticated users only`
4. 点击 **Review**
5. 点击 **Save policy**

### 策略4：用户删除自己的文件（Optional）

1. 点击 **Create policy**
2. 选择 **For full customization**
3. 配置：
   - **Policy name**: `User Delete Own Files`
   - **Allowed operations**: `DELETE`
   - **Policy definition**: 使用以下SQL：
     ```sql
     (
       bucket_id = 'emotion-images' 
       AND auth.role() = 'authenticated'
       AND (storage.foldername(name))[1] = auth.uid()::text
     )
     ```
   - **Policy applies to**: `Authenticated users only`
4. 点击 **Review**
5. 点击 **Save policy**

## 步骤4：验证设置

### 方法1：使用测试脚本
```bash
python3 test_storage_permissions.py
```

### 方法2：手动测试

1. **测试公共读取**：
   ```bash
   curl -X GET "https://ojcvrvutsylptamslntq.supabase.co/storage/v1/object/list/emotion-images" \
     -H "apikey: sb_publishable_UZf341-Gio8qK8M0EZUoQQ_g2X9TW8i"
   ```

2. **测试上传**（需要认证token）：
   ```bash
   # 首先获取用户token（通过登录）
   # 然后使用token上传文件
   curl -X POST "https://ojcvrvutsylptamslntq.supabase.co/storage/v1/object/emotion-images/test.jpg" \
     -H "Authorization: Bearer USER_TOKEN_HERE" \
     -H "Content-Type: image/jpeg" \
     --data-binary @test.jpg
   ```

## 步骤5：前端代码已经就绪

前端代码 (`components/CompanionView.tsx`) 已经更新，包含：

1. **图片上传功能**：在添加情感笔记时可以选择上传图片
2. **错误处理**：如果存储桶权限未设置，会优雅降级（保存笔记但不保存图片）
3. **日志记录**：详细的错误日志帮助调试

## 故障排除

### 问题1：`Error: 42501: must be owner of table objects`
- **原因**：尝试通过SQL直接修改系统表
- **解决方案**：使用Supabase Dashboard UI设置策略，不要使用SQL Editor

### 问题2：存储桶不存在
- **解决方案**：
  1. 通过Dashboard UI创建存储桶
  2. 或运行 `python3 create_bucket_local.py`

### 问题3：权限被拒绝
- **检查**：
  1. 存储桶是否标记为 **Public**
  2. 策略是否正确设置
  3. RLS是否启用（通常默认启用）

### 问题4：上传失败但前端不报错
- **原因**：前端代码有错误处理，会静默失败
- **检查浏览器控制台**：查看详细的错误信息

## 完成后的验证

设置完成后，你应该能够：

1. ✅ 匿名用户查看存储桶中的图片
2. ✅ 认证用户上传图片到存储桶
3. ✅ 用户更新/删除自己上传的图片
4. ✅ 前端正常显示上传的图片

如果仍有问题，请检查浏览器控制台日志或联系Supabase支持。