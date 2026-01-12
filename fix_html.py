
import os

file_path = 'src/content.ts'

with open(file_path, 'r', encoding='utf-8') as f:
    content = f.read()

corrupted_string = '< input type = "checkbox" id = "sonar-opt-kaomoji" >'
clean_html = """            <label class="sonar-checkbox-label" title="在句尾加入顏文字 (´・ω・`)">
                <input type="checkbox" id="sonar-opt-kaomoji"> 顏文字 (Kaomoji)
            </label>"""

if corrupted_string in content:
    print("Found corrupted string. Attempting to locate and replace the surrounding corrupted block.")
    
    # The corruption seems to span multiple lines. 
    # Let's verify what the surrounding lines look like exactly to replace the block safely.
    # From grep output:
    # 958:              <label class="sonar-checkbox-label" title="在句尾加入顏文字 (´・ω・`) ">
    # 959:        < input type = "checkbox" id = "sonar-opt-kaomoji" > 顏文字(Kaomoji)
    # 960:          </label>
    
    # We will look for this simplified pattern to be safe
    # But wait, there might be other corruptions like "< !--Preferences: Length-- >"
    
    # Let's try to replace the SPECIFIC corrupted lines with their clean versions first.
    
    # Fix Kaomoji Checkbox
    old_fragment_kaomoji = '< input type = "checkbox" id = "sonar-opt-kaomoji" > 顏文字(Kaomoji)'
    new_fragment_kaomoji = '<input type="checkbox" id="sonar-opt-kaomoji"> 顏文字 (Kaomoji)'
    
    content = content.replace(old_fragment_kaomoji, new_fragment_kaomoji)
    
    # Fix Preferences Comment
    content = content.replace('< !--Preferences: Length-- >', '<!-- Preferences: Length -->')
    
    # Fix Reply Length Selector
    # old: < select id = "sonar-reply-length" class="sonar-select" style = "width:100%; padding:6px; border-radius:6px; border:1px solid #cbd5e1; font-size:13px;" >
    # This is hard to match exactly due to whitespace. 
    # Let's match simpler unique substrings.
    
    content = content.replace('< select id = "sonar-reply-length"', '<select id="sonar-reply-length"')
    
    # Fix Options
    content = content.replace('< option value = "medium" >', '<option value="medium">')
    content = content.replace('< option value = "long" >', '<option value="long">')
    
    # Fix Tools Area Comment
    content = content.replace('< !--Tools Area-- >', '<!-- Tools Area -->')
    
    # Fix Footer div
    content = content.replace('< div class="sonar-footer" >', '<div class="sonar-footer">')
    
    # Fix Button
    content = content.replace('< button id = "sonar-settings-btn"', '<button id="sonar-sidebar-settings"') # Wait, ID might be different in corrupted version
    
    # Let's just write back the critical fixes first to stop the build error.
    
    with open(file_path, 'w', encoding='utf-8') as f:
        f.write(content)
    print("Successfully replaced known corrupted strings.")
else:
    print("Corrupted string NOT found in file content read by Python.")
