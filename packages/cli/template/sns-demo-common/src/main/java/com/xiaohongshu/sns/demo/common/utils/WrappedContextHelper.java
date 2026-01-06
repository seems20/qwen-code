package com.xiaohongshu.sns.demo.common.utils;

import com.fasterxml.jackson.annotation.JsonProperty;
import com.xiaohongshu.infra.apm.utils.ContextHelper;
import com.xiaohongshu.infra.rpc.base.Context;

import com.xiaohongshu.sns.demo.common.constants.AppPlatform;
import lombok.Data;
import lombok.extern.slf4j.Slf4j;
import org.apache.commons.lang3.ObjectUtils;
import org.apache.commons.lang3.StringUtils;
import org.apache.commons.lang3.math.NumberUtils;
import org.springframework.stereotype.Component;
import org.springframework.util.CollectionUtils;

import java.net.URLDecoder;
import java.util.Collections;
import java.util.HashMap;
import java.util.Map;
import java.util.Optional;

/**
 * 对中间件 ContextHelper 的封装，便于拿到当前的请求信息。
 * 整合了 ContextUtils 现有功能及增强的上下文解析能力。
 *
 * @author RDMind
 */
@Component
@Slf4j
public class WrappedContextHelper {

    public static final String APP_CONTEXT_PREFIX = "__app_context:";
    public static final String HTTP_HEADER = "httpHeader";

    /**
     * 获取原始 Context
     */
    public static Context get() {
        return ContextHelper.getContext();
    }

    /**
     * 获取当前用户 ID
     */
    public static String getUserId() {
        Context context = get();
        if (context == null) {
            return StringUtils.EMPTY;
        }
        String userId = context.getUserID();
        if (StringUtils.isBlank(userId)) {
            Map<String, String> baggageMap = context.getBaggage();
            if (!CollectionUtils.isEmpty(baggageMap)) {
                userId = baggageMap.get("viewerUserId");
            }
        }
        return StringUtils.isBlank(userId) ? StringUtils.EMPTY : userId;
    }

    /**
     * 获取当前操作者邮箱
     */
    public static String getUserEmail() {
        Context context = get();
        return context == null ? StringUtils.EMPTY : context.getBaggage().getOrDefault("__app_context:operatorEmail", StringUtils.EMPTY);
    }

    /**
     * 获取当前操作者展示名称
     */
    public static String getUserDisplayName() {
        Context context = get();
        return context == null ? StringUtils.EMPTY : context.getBaggage().getOrDefault("__app_context:displayName", StringUtils.EMPTY);
    }

    /**
     * 获取当前操作者真实姓名
     */
    public static String getUserRealName() {
        Context context = get();
        return context == null ? StringUtils.EMPTY : context.getBaggage().getOrDefault("__app_context:operatorName", StringUtils.EMPTY);
    }

    /**
     * 获取当前用户IP
     */
    public static String getUserIp() {
        Context context = get();
        if (context == null) {
            return StringUtils.EMPTY;
        }
        return StringUtils.isBlank(context.getUserIP()) ? StringUtils.EMPTY : context.getUserIP();
    }

    /**
     * 获取 requestId
     */
    public static String getRequestId() {
        Context context = get();
        if (context == null || CollectionUtils.isEmpty(context.getBaggage())) {
            return StringUtils.EMPTY;
        }
        return context.getBaggage().getOrDefault(APP_CONTEXT_PREFIX + "requestId", StringUtils.EMPTY);
    }

    /**
     * 获取当前客户端平台
     */
    public static String getPlatform() {
        Context context = get();
        if (context == null) {
            return AppPlatform.UNKNOWN.value();
        }
        String platform = context.getAppPlatform();
        return StringUtils.isBlank(platform) ? AppPlatform.UNKNOWN.value() : AppPlatform.findBy(platform).value();
    }

    /**
     * 获取 networkType
     */
    public static int getNetworkType() {
        String cAppNetworkType = ContextHelper.getAppContext("c_app_network_type");
        return NumberUtils.toInt(cAppNetworkType);
    }

    public static String getHttpHeaderStr() {
        Context context = get();
        if (context == null) {
            return StringUtils.EMPTY;
        }
        Map<String, String> baggage = Optional.ofNullable(context.getBaggage()).orElse(Collections.emptyMap());
        return baggage.getOrDefault(APP_CONTEXT_PREFIX + HTTP_HEADER, "");
    }

    private HttpHeader getParsedHttpHeader() {
        Context context = get();
        if (context != null && context.getBaggage().containsKey(APP_CONTEXT_PREFIX + HTTP_HEADER)) {
            String headerJson = ContextHelper.getAppContext(HTTP_HEADER);
            HttpHeader header = JsonHelper.fromJson(headerJson, HttpHeader.class, false);
            return ObjectUtils.defaultIfNull(header, new HttpHeader());
        }
        return new HttpHeader();
    }

    /**
     * 内部封装的 Http Header 对象 (使用 Jackson 注解)
     */
    @Data
    static class HttpHeader {
        @JsonProperty("User-Agent")
        private String userAgent;
        @JsonProperty("xy-common-params")
        private String commonParams;
        @JsonProperty("X-Network-Source")
        private String xNetworkSource;
        @JsonProperty("Xy-Platform-Info")
        private String platformInfo;
    }

    private Map<String, String> parseCommonParams() {
        String paramStr = this.getParsedHttpHeader().getCommonParams();
        if (StringUtils.isEmpty(paramStr)) {
            return Collections.emptyMap();
        }
        Map<String, String> params = new HashMap<>();
        for (String kv : paramStr.split("&")) {
            String[] arr = kv.split("=");
            if (arr.length == 2) {
                try {
                    params.put(arr[0], URLDecoder.decode(arr[1], "UTF-8"));
                } catch (Exception e) {
                    // ignore
                }
            }
        }
        return params;
    }

    public String getDeviceId() {
        return StringUtils.trimToEmpty(parseCommonParams().get("deviceId"));
    }
}
