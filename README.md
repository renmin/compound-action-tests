# Compound Action Tests

本项目用于编写和验证远程浏览器自动化的交互动作，所有测试页面均基于统一模板，支持断言注册、结果展示和二维码输出。

## 目录结构

- `tests/template.html`：测试页面模板，包含公共结构和脚手架代码。
- `tests/common.js`、`tests/common.css`：所有测试页面共享的 JS 和 CSS。
- `tests/example_basic.html`：基于模板的示例测试页。

## 如何创建一个新的测试页面（手动方式）

1. 复制 `tests/template.html`，重命名为 `tests/your_test_name.html`。
2. 修改 `<title>`、`<h1>`、说明等内容，添加你的测试描述。
3. 在 `<div id="stage" class="stage">` 区域添加你的测试控件（如按钮、输入框等）。
4. 在 `<script>` 区域，实例化 `TestManager`，并注册断言。例如：

   ```js
   const testManager = new window.__TestCommon({
     testName: 'Your Test Name',
     runId: qs.get('run'),
     startedAt: new Date().toISOString()
   });

   // 注册断言
   testManager.registerAssertion('assertion name', {key: value}, async () => ({key: value}));
   ```

5. 保存后即可在浏览器中访问新页面进行测试。

## 示例

参考 `tests/example_basic.html`，实现了点击和输入的断言验证。

---

如需更详细的说明或脚本用法补充，请告知。
