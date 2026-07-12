@props(['url'])
<tr>
<td class="header">
<a href="{{ $url }}" style="display: inline-block;">
{{-- Absolute URL from APP_URL: mail clients cannot resolve relative paths,
     and SVG is unsupported in Gmail/Outlook, so the PNG mark is used. --}}
<img src="{{ asset('apple-touch-icon.png') }}" class="logo" alt="{{ trim($slot) }}" width="48" height="48" style="height: 48px; width: 48px;">
</a>
</td>
</tr>
